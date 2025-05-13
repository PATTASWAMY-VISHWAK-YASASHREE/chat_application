#!/usr/bin/env python3
"""
Database management script for chat application.
This script provides utilities to manage the chat application database.
"""

import argparse
import psycopg2
import sys
import logging
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("db_management.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("DBManagement")

# Database configuration
DB_CONFIG = {
    'dbname': 'chat_application',
    'user': 'postgres',
    'password': 'vishwak',
    'host': 'localhost',
    'port': '5432'  # Default PostgreSQL port
}

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

def list_users():
    """List all users in the database"""
    conn = get_db_connection()
    if not conn:
        return
    
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT id, username, last_seen, email, is_active, created_at 
        FROM chat_users 
        ORDER BY id
        """)
        
        users = cursor.fetchall()
        
        if not users:
            print("No users found in the database.")
            return
            
        print("\n{:<5} {:<20} {:<30} {:<30} {:<10} {:<20}".format(
            "ID", "Username", "Email", "Last Seen", "Active", "Created At"))
        print("-" * 115)
        
        for user in users:
            user_id, username, last_seen, email, is_active, created_at = user
            print("{:<5} {:<20} {:<30} {:<30} {:<10} {:<20}".format(
                user_id, 
                username, 
                email if email else "N/A", 
                last_seen.strftime("%Y-%m-%d %H:%M:%S") if last_seen else "Never", 
                "Yes" if is_active else "No",
                created_at.strftime("%Y-%m-%d %H:%M:%S") if created_at else "N/A"
            ))
            
    except Exception as e:
        logger.error(f"Error listing users: {e}")
    finally:
        cursor.close()
        conn.close()

def list_messages(limit=20):
    """List recent messages in the database"""
    conn = get_db_connection()
    if not conn:
        return
    
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT m.id, u.username, m.message, m.timestamp, m.is_private, r.username as recipient
        FROM chat_messages m
        JOIN chat_users u ON m.sender_id = u.id
        LEFT JOIN chat_users r ON m.recipient_id = r.id
        ORDER BY m.timestamp DESC
        LIMIT %s
        """, (limit,))
        
        messages = cursor.fetchall()
        
        if not messages:
            print("No messages found in the database.")
            return
            
        print("\n{:<5} {:<15} {:<50} {:<20} {:<10} {:<15}".format(
            "ID", "Sender", "Message", "Timestamp", "Private", "Recipient"))
        print("-" * 115)
        
        for message in reversed(messages):  # Show in chronological order
            msg_id, username, msg_text, timestamp, is_private, recipient = message
            
            # Truncate long messages
            if len(msg_text) > 47:
                msg_text = msg_text[:47] + "..."
                
            print("{:<5} {:<15} {:<50} {:<20} {:<10} {:<15}".format(
                msg_id, 
                username, 
                msg_text, 
                timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "Yes" if is_private else "No",
                recipient if recipient else "All"
            ))
            
    except Exception as e:
        logger.error(f"Error listing messages: {e}")
    finally:
        cursor.close()
        conn.close()

def create_user(username, email=None, password=None):
    """Create a new user in the database"""
    conn = get_db_connection()
    if not conn:
        return
    
    cursor = conn.cursor()
    try:
        # Check if user already exists
        cursor.execute("SELECT id FROM chat_users WHERE username = %s", (username,))
        if cursor.fetchone():
            print(f"User '{username}' already exists.")
            return
            
        # Create new user
        cursor.execute("""
        INSERT INTO chat_users (username, email, password_hash, last_seen, created_at) 
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """, (username, email, password, datetime.now(), datetime.now()))
        
        user_id = cursor.fetchone()[0]
        conn.commit()
        
        print(f"User '{username}' created successfully with ID: {user_id}")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating user: {e}")
    finally:
        cursor.close()
        conn.close()

def delete_user(username):
    """Delete a user from the database"""
    conn = get_db_connection()
    if not conn:
        return
    
    cursor = conn.cursor()
    try:
        # Check if user exists
        cursor.execute("SELECT id FROM chat_users WHERE username = %s", (username,))
        result = cursor.fetchone()
        if not result:
            print(f"User '{username}' does not exist.")
            return
            
        user_id = result[0]
        
        # Delete user's messages
        cursor.execute("DELETE FROM chat_messages WHERE sender_id = %s", (user_id,))
        msg_count = cursor.rowcount
        
        # Delete user's room messages
        cursor.execute("DELETE FROM room_messages WHERE sender_id = %s", (user_id,))
        room_msg_count = cursor.rowcount
        
        # Delete user's room memberships
        cursor.execute("DELETE FROM room_members WHERE user_id = %s", (user_id,))
        
        # Delete rooms created by user
        cursor.execute("DELETE FROM chat_rooms WHERE created_by = %s", (user_id,))
        
        # Finally delete the user
        cursor.execute("DELETE FROM chat_users WHERE id = %s", (user_id,))
        
        conn.commit()
        
        print(f"User '{username}' deleted successfully.")
        print(f"Deleted {msg_count} messages and {room_msg_count} room messages.")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting user: {e}")
    finally:
        cursor.close()
        conn.close()

def purge_old_messages(days=30):
    """Delete messages older than specified days"""
    conn = get_db_connection()
    if not conn:
        return
    
    cursor = conn.cursor()
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Delete old messages
        cursor.execute("DELETE FROM chat_messages WHERE timestamp < %s", (cutoff_date,))
        msg_count = cursor.rowcount
        
        # Delete old room messages
        cursor.execute("DELETE FROM room_messages WHERE timestamp < %s", (cutoff_date,))
        room_msg_count = cursor.rowcount
        
        conn.commit()
        
        print(f"Purged {msg_count} messages and {room_msg_count} room messages older than {days} days.")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error purging old messages: {e}")
    finally:
        cursor.close()
        conn.close()

def create_room(name, description=None, created_by=None, is_private=False):
    """Create a new chat room"""
    conn = get_db_connection()
    if not conn:
        return
    
    cursor = conn.cursor()
    try:
        # Check if room already exists
        cursor.execute("SELECT id FROM chat_rooms WHERE name = %s", (name,))
        if cursor.fetchone():
            print(f"Room '{name}' already exists.")
            return
            
        # Create new room
        cursor.execute("""
        INSERT INTO chat_rooms (name, description, created_by, is_private, created_at) 
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """, (name, description, created_by, is_private, datetime.now()))
        
        room_id = cursor.fetchone()[0]
        
        # If created_by is provided, add that user as an admin
        if created_by:
            cursor.execute("""
            INSERT INTO room_members (room_id, user_id, is_admin, joined_at) 
            VALUES (%s, %s, %s, %s)
            """, (room_id, created_by, True, datetime.now()))
        
        conn.commit()
        
        print(f"Room '{name}' created successfully with ID: {room_id}")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating room: {e}")
    finally:
        cursor.close()
        conn.close()

def list_rooms():
    """List all chat rooms"""
    conn = get_db_connection()
    if not conn:
        return
    
    cursor = conn.cursor()
    try:
        cursor.execute("""
        SELECT r.id, r.name, r.description, u.username, r.is_private, r.created_at,
               COUNT(DISTINCT rm.user_id) as member_count
        FROM chat_rooms r
        LEFT JOIN chat_users u ON r.created_by = u.id
        LEFT JOIN room_members rm ON r.id = rm.room_id
        GROUP BY r.id, r.name, r.description, u.username, r.is_private, r.created_at
        ORDER BY r.id
        """)
        
        rooms = cursor.fetchall()
        
        if not rooms:
            print("No rooms found in the database.")
            return
            
        print("\n{:<5} {:<20} {:<30} {:<15} {:<10} {:<20} {:<10}".format(
            "ID", "Name", "Description", "Created By", "Private", "Created At", "Members"))
        print("-" * 115)
        
        for room in rooms:
            room_id, name, description, creator, is_private, created_at, member_count = room
            
            # Truncate long descriptions
            if description and len(description) > 27:
                description = description[:27] + "..."
                
            print("{:<5} {:<20} {:<30} {:<15} {:<10} {:<20} {:<10}".format(
                room_id, 
                name, 
                description if description else "N/A", 
                creator if creator else "System", 
                "Yes" if is_private else "No",
                created_at.strftime("%Y-%m-%d %H:%M:%S") if created_at else "N/A",
                member_count
            ))
            
    except Exception as e:
        logger.error(f"Error listing rooms: {e}")
    finally:
        cursor.close()
        conn.close()

def backup_database(filename=None):
    """Backup the database to a SQL file"""
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"chat_backup_{timestamp}.sql"
    
    try:
        import subprocess
        
        # Use pg_dump to create a backup
        cmd = [
            "pg_dump",
            "-h", DB_CONFIG['host'],
            "-p", DB_CONFIG['port'],
            "-U", DB_CONFIG['user'],
            "-d", DB_CONFIG['dbname'],
            "-f", filename
        ]
        
        # Set PGPASSWORD environment variable
        env = dict(PGPASSWORD=DB_CONFIG['password'])
        
        logger.info(f"Backing up database to {filename}")
        result = subprocess.run(cmd, env=env, capture_output=True, text=True)
        
        if result.returncode == 0:
            logger.info(f"Database backup completed successfully: {filename}")
            print(f"Database backup created: {filename}")
        else:
            logger.error(f"Database backup failed: {result.stderr}")
            print(f"Backup failed: {result.stderr}")
            
    except Exception as e:
        logger.error(f"Error backing up database: {e}")
        print(f"Error: {e}")

def main():
    parser = argparse.ArgumentParser(description="Chat Application Database Management")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # List users command
    list_users_parser = subparsers.add_parser("list-users", help="List all users")
    
    # List messages command
    list_msgs_parser = subparsers.add_parser("list-messages", help="List recent messages")
    list_msgs_parser.add_argument("--limit", type=int, default=20, help="Number of messages to show")
    
    # Create user command
    create_user_parser = subparsers.add_parser("create-user", help="Create a new user")
    create_user_parser.add_argument("username", help="Username for the new user")
    create_user_parser.add_argument("--email", help="Email address for the user")
    create_user_parser.add_argument("--password", help="Password for the user")
    
    # Delete user command
    delete_user_parser = subparsers.add_parser("delete-user", help="Delete a user")
    delete_user_parser.add_argument("username", help="Username to delete")
    
    # Purge old messages command
    purge_parser = subparsers.add_parser("purge-messages", help="Delete old messages")
    purge_parser.add_argument("--days", type=int, default=30, help="Delete messages older than this many days")
    
    # Create room command
    create_room_parser = subparsers.add_parser("create-room", help="Create a new chat room")
    create_room_parser.add_argument("name", help="Name for the new room")
    create_room_parser.add_argument("--description", help="Description of the room")
    create_room_parser.add_argument("--created-by", type=int, help="User ID of room creator")
    create_room_parser.add_argument("--private", action="store_true", help="Make the room private")
    
    # List rooms command
    list_rooms_parser = subparsers.add_parser("list-rooms", help="List all chat rooms")
    
    # Backup database command
    backup_parser = subparsers.add_parser("backup", help="Backup the database")
    backup_parser.add_argument("--filename", help="Output filename for the backup")
    
    args = parser.parse_args()
    
    if args.command == "list-users":
        list_users()
    elif args.command == "list-messages":
        list_messages(args.limit)
    elif args.command == "create-user":
        create_user(args.username, args.email, args.password)
    elif args.command == "delete-user":
        delete_user(args.username)
    elif args.command == "purge-messages":
        purge_old_messages(args.days)
    elif args.command == "create-room":
        create_room(args.name, args.description, args.created_by, args.private)
    elif args.command == "list-rooms":
        list_rooms()
    elif args.command == "backup":
        backup_database(args.filename)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()