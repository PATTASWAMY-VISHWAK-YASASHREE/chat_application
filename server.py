import socket
import threading
import sys
import psycopg2
import datetime
import logging
import signal
import json

# Use IPv4 address instead of IPv6
host = '127.0.0.1'  # IPv4 localhost
port = 5054
listener_limit = 100

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("ChatServer")

active_clients = []  # List of connected clients
client_usernames = {}  # Dictionary to store client socket: username pairs

# Database configuration
DB_CONFIG = {
    'dbname': 'chat_application',
    'user': 'postgres',
    'password': 'vishwak',
    'host': 'localhost',
    'port': '5432'  # Default PostgreSQL port
}

# Global flag for server running state
server_running = True

def get_db_connection():
    """Create and return a database connection"""
    try:
        logger.info(f"Connecting to database: {DB_CONFIG['dbname']} on {DB_CONFIG['host']}")
        conn = psycopg2.connect(**DB_CONFIG)
        logger.info("Database connection established successfully")
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None

def setup_database():
    """Create database tables if they don't exist"""
    conn = get_db_connection()
    if not conn:
        logger.error("Failed to connect to database. Chat history will not be saved.")
        return False
    
    cursor = conn.cursor()
    
    try:
        # Create users table
        logger.info("Creating chat_users table if it doesn't exist")
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            last_seen TIMESTAMP,
            email VARCHAR(255),
            password_hash VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            theme VARCHAR(50) DEFAULT 'default',
            font_size INTEGER DEFAULT 12,
            notification_preference VARCHAR(20) DEFAULT 'all'
        )
        ''')
        
        # Create messages table
        logger.info("Creating chat_messages table if it doesn't exist")
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER,
            message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_private BOOLEAN DEFAULT FALSE,
            recipient_id INTEGER NULL,
            message_type VARCHAR(20) DEFAULT 'text',
            read_status BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (sender_id) REFERENCES chat_users (id),
            FOREIGN KEY (recipient_id) REFERENCES chat_users (id)
        )
        ''')
        
        # Create chat rooms table
        logger.info("Creating chat_rooms table if it doesn't exist")
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_rooms (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            is_private BOOLEAN DEFAULT FALSE,
            room_theme VARCHAR(50) DEFAULT 'default',
            FOREIGN KEY (created_by) REFERENCES chat_users (id)
        )
        ''')
        
        # Create room messages table
        logger.info("Creating room_messages table if it doesn't exist")
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS room_messages (
            id SERIAL PRIMARY KEY,
            room_id INTEGER,
            sender_id INTEGER,
            message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
            FOREIGN KEY (sender_id) REFERENCES chat_users (id)
        )
        ''')
        
        # Create room members table
        logger.info("Creating room_members table if it doesn't exist")
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS room_members (
            room_id INTEGER,
            user_id INTEGER,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_admin BOOLEAN DEFAULT FALSE,
            PRIMARY KEY (room_id, user_id),
            FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
            FOREIGN KEY (user_id) REFERENCES chat_users (id)
        )
        ''')
        
        # Create some indexes for performance
        logger.info("Creating indexes for better performance")
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages (timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_room_messages_timestamp ON room_messages (timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON room_messages (room_id)')
        
        conn.commit()
        logger.info("Database schema setup complete")
        return True
    except Exception as e:
        logger.error(f"Error setting up database: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

def get_or_create_user(username, theme='default'):
    """Get user ID from database or create if not exists"""
    conn = get_db_connection()
    if not conn:
        return None, theme
        
    cursor = conn.cursor()
    
    # Try to find existing user
    cursor.execute("SELECT id, theme FROM chat_users WHERE username = %s", (username,))
    result = cursor.fetchone()
    
    if result:
        user_id = result[0]
        user_theme = result[1]
    else:
        # Create new user with default theme
        cursor.execute("""
            INSERT INTO chat_users (username, last_seen, theme) 
            VALUES (%s, %s, %s) 
            RETURNING id
        """, (username, datetime.datetime.now(), theme))
        user_id = cursor.fetchone()[0]
        user_theme = theme
    
    # Update last seen
    cursor.execute("UPDATE chat_users SET last_seen = %s WHERE id = %s", 
                  (datetime.datetime.now(), user_id))
    conn.commit()
    cursor.close()
    conn.close()
    
    return user_id, user_theme

def save_message(username, message_text, message_type='text', is_private=False, recipient=None):
    """Save message to database"""
    try:
        conn = get_db_connection()
        if not conn:
            return False
            
        cursor = conn.cursor()
        
        # Get user ID
        user_id, _ = get_or_create_user(username)
        if not user_id:
            return False
        
        recipient_id = None
        if is_private and recipient:
            # Get recipient ID if this is a private message
            recipient_id, _ = get_or_create_user(recipient)
        
        # Fix empty attributes issue - convert None values to appropriate defaults
        if message_type is None:
            message_type = 'text'
        
        if is_private is None:
            is_private = False
            
        # Save message with additional metadata
        cursor.execute("""
            INSERT INTO chat_messages 
            (sender_id, message, timestamp, message_type, is_private, recipient_id) 
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (user_id, message_text, datetime.datetime.now(), message_type, is_private, recipient_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Database error: {e}")
        return False

def get_recent_messages(limit=10):
    """Get recent messages from database grouped by user"""
    conn = get_db_connection()
    if not conn:
        return {}
        
    cursor = conn.cursor()
    
    # Get all unique users who have sent messages
    cursor.execute('''
    SELECT DISTINCT u.username
    FROM chat_messages m
    JOIN chat_users u ON m.sender_id = u.id
    ORDER BY u.username
    ''')
    
    users = [row[0] for row in cursor.fetchall()]
    
    # Get messages for each user
    user_messages = {}
    for username in users:
        cursor.execute('''
        SELECT u.username, m.message, m.timestamp 
        FROM chat_messages m
        JOIN chat_users u ON m.sender_id = u.id
        WHERE u.username = %s
        ORDER BY m.timestamp DESC
        LIMIT %s
        ''', (username, limit))
        
        messages = cursor.fetchall()
        
        # Convert to list of dictionaries
        message_list = []
        for msg in messages:
            message_list.append({
                'username': msg[0],
                'message': msg[1],
                'timestamp': msg[2]
            })
        
        # Store messages in chronological order
        user_messages[username] = list(reversed(message_list))
    
    cursor.close()
    conn.close()
    
    return user_messages

def broadcast_message(message, _client):
    """Send message to all connected clients except the sender"""
    for client in active_clients:
        if client != _client:
            try:
                client.send(message)
            except:
                # If sending fails, remove the client
                remove_client(client)

def remove_client(client):
    """Remove a client from the active clients list"""
    if client in active_clients:
        username = client_usernames.get(client, "Unknown")
        active_clients.remove(client)
        if client in client_usernames:
            del client_usernames[client]
        broadcast_message(f"{username} has left the chat!".encode('utf-8'), None)
        logger.info(f"Client {username} disconnected")
        
        # Send updated user list to all remaining clients
        broadcast_user_list()

def broadcast_user_list():
    """Send updated user list to all clients"""
    user_list = list(client_usernames.values())
    user_list_data = {
        "type": "user_list",
        "users": user_list
    }
    
    message = json.dumps(user_list_data).encode('utf-8')
    for client in active_clients:
        try:
            client.send(message)
        except:
            # If sending fails, remove the client
            remove_client(client)

def handle_client(client, address):
    """Handle communication with a single client"""
    try:
        # Wait for the first message which should contain the username
        message = client.recv(1024).decode('utf-8')
        
        # Extract username from first message
        if message.startswith("USERNAME:"):
            username = message[9:]
            client_usernames[client] = username
            active_clients.append(client)
            
            # Save user to database and get theme
            user_id, user_theme = get_or_create_user(username)
            
            # Notify all clients about the new connection
            join_message = f"{username} has joined the chat!"
            broadcast_message(join_message.encode('utf-8'), client)
            logger.info(f"New client {username} connected from {address[0]}:{address[1]}")
            
            # Send welcome message to the new client
            welcome_message = f"Welcome to the chat, {username}!"
            client.send(welcome_message.encode('utf-8'))
            
            # Send user settings including theme
            settings_data = {
                "type": "settings",
                "theme": user_theme,
                "username": username
            }
            client.send(json.dumps(settings_data).encode('utf-8'))
            
            # Send list of active users to the new client
            user_list = list(client_usernames.values())
            user_list_data = {
                "type": "user_list",
                "users": user_list
            }
            client.send(json.dumps(user_list_data).encode('utf-8'))
            
            # Send updated user list to all clients
            broadcast_user_list()
            
            # Send recent chat history to the new client as JSON, grouped by user
            user_messages = get_recent_messages(10)  # Get last 10 messages per user
            history_data = {
                "type": "history",
                "userMessages": {}
            }
            
            # Format each user's messages
            for user, messages in user_messages.items():
                history_data["userMessages"][user] = [
                    {
                        "username": msg["username"],
                        "message": msg["message"],
                        "timestamp": msg["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                        "message_type": msg.get("message_type", "text"),
                        "is_private": msg.get("is_private", False)
                    } for msg in messages
                ]
            
            history_json = json.dumps(history_data)
            client.send(history_json.encode('utf-8'))
        
        # Main message handling loop
        while server_running:
            message_bytes = client.recv(4096)  # Increased buffer size for encrypted messages
            if not message_bytes:
                break
                
            message_text = message_bytes.decode('utf-8')
            
            # Try to parse as JSON for special messages
            try:
                data = json.loads(message_text)
                message_type = data.get("type", "")
                
                # Handle public key request
                if message_type == "public_key_request":
                    requester = data.get("requester")
                    target = data.get("target")
                    
                    # Find the target client
                    target_client = None
                    for c, name in client_usernames.items():
                        if name == target:
                            target_client = c
                            break
                    
                    if target_client:
                        # Forward the request to the target
                        target_client.send(message_bytes)
                    continue
                
                # Handle public key response
                elif message_type == "public_key_response":
                    sender = data.get("sender")
                    recipient = data.get("recipient")
                    
                    # Find the recipient client
                    recipient_client = None
                    for c, name in client_usernames.items():
                        if name == recipient:
                            recipient_client = c
                            break
                    
                    if recipient_client:
                        # Forward the response to the recipient
                        recipient_client.send(message_bytes)
                    continue
                
                # Handle private message
                elif message_type == "private_message":
                    sender = data.get("sender")
                    recipient = data.get("recipient")
                    
                    # Find the recipient client
                    recipient_client = None
                    for c, name in client_usernames.items():
                        if name == recipient:
                            recipient_client = c
                            break
                    
                    if recipient_client:
                        # Forward the encrypted message to the recipient only
                        recipient_client.send(message_bytes)
                    continue
                
                # Handle typing indicator
                elif message_type == "typing":
                    # Already handled by the existing code
                    pass
                    
            except json.JSONDecodeError:
                # Not JSON, continue with normal message handling
                pass
            
            # Handle typing indicator
            if message_text.startswith("TYPING:"):
                username = message_text[7:]
                # Create typing indicator message
                typing_data = {
                    "type": "typing",
                    "username": username,
                    "isTyping": True
                }
                # Broadcast typing status to all other clients
                broadcast_message(json.dumps(typing_data).encode('utf-8'), client)
                continue
                
            # Handle stopped typing indicator
            if message_text.startswith("STOPPED_TYPING:"):
                username = message_text[15:]
                # Create stopped typing indicator message
                typing_data = {
                    "type": "typing",
                    "username": username,
                    "isTyping": False
                }
                # Broadcast typing status to all other clients
                broadcast_message(json.dumps(typing_data).encode('utf-8'), client)
                continue
            
            # Extract username from message format "Username: Message"
            if ": " in message_text:
                username, content = message_text.split(": ", 1)
                # Save message to database with null checks for empty attributes
                message_type = "text"  # Default value
                is_private = False     # Default value
                save_message(username, content, message_type, is_private)
                
                # Broadcast public message to all clients
                broadcast_message(message_bytes, client)
            
    except Exception as e:
        logger.error(f"Error handling client {address}: {e}")
    finally:
        remove_client(client)
        client.close()

def signal_handler(sig, frame):
    """Handle Ctrl+C signal to gracefully shut down the server"""
    global server_running
    logger.info("\nShutdown signal received. Closing server...")
    print("\nShutdown signal received. Closing server...")
    server_running = False
    
    # Close all client connections
    for client in list(active_clients):
        try:
            client.close()
        except:
            pass
    
    sys.exit(0)

def main():
    global server_running
    
    # Register signal handler for Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info("Starting chat server...")
    print("Starting chat server...")
    
    # Setup database
    db_ready = setup_database()
    if not db_ready:
        logger.warning("Database setup failed. Continuing without message persistence.")
        print("Warning: Database setup failed. Continuing without message persistence.")
    else:
        logger.info(f"Successfully connected to database: {DB_CONFIG['dbname']}")
        print(f"Successfully connected to database: {DB_CONFIG['dbname']}")
    
    # Create IPv4 socket
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    
    # Allow port reuse
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server.bind((host, port))
        logger.info(f"Successfully bound to host {host} and port {port}")
        print(f"Successfully bound to host {host} and port {port}")
        
        server.listen(listener_limit)
        logger.info(f"Server is listening for connections...")
        print(f"Server is listening for connections...")
        print("Press Ctrl+C to stop the server")
        
        # Set a timeout on the socket to allow for keyboard interrupts
        server.settimeout(1.0)
        
        while server_running:
            try:
                client, address = server.accept()
                logger.info(f"New connection from {address[0]}:{address[1]}")
                print(f"New connection from {address[0]}:{address[1]}")
                
                # Create a new thread to handle this client
                client_handler = threading.Thread(target=handle_client, args=(client, address))
                client_handler.daemon = True
                client_handler.start()
            except socket.timeout:
                # This is just to allow the KeyboardInterrupt to be caught
                continue
            
    except socket.error as e:
        logger.error(f"Socket error: {e}")
        print(f"Socket error: {e}")
    except Exception as e:
        logger.error(f"Error: {e}")
        print(f"Error: {e}")
    finally:
        server_running = False
        
        # Close the server socket
        if server:
            server.close()
            
        logger.info("Server has been shut down")
        print("Server has been shut down")

if __name__ == "__main__":
    main()