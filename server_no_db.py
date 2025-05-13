import socket
import threading
import sys
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

# Global flag for server running state
server_running = True

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
                "theme": "default",
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
    
    logger.info("Starting chat server (No Database Mode)...")
    print("Starting chat server (No Database Mode)...")
    print("Note: Messages will not be persisted without a database connection.")
    
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