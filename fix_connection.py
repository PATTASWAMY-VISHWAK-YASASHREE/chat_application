#!/usr/bin/env python3
"""
Script to fix connection issues in the chat application.
This script will update both client.py and server.py to use IPv4 instead of IPv6.
"""

import os
import re
import sys

def fix_client_file():
    """Fix the client.py file to use IPv4 instead of IPv6"""
    client_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "client.py")
    
    try:
        with open(client_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Replace IPv6 with IPv4 in host definition
        content = content.replace("host = '::1'", "host = '127.0.0.1'")
        content = content.replace("# IPv6 localhost", "# IPv4 localhost")
        
        # Replace socket creation
        content = content.replace("socket.AF_INET6", "socket.AF_INET")
        
        with open(client_path, 'w', encoding='utf-8') as file:
            file.write(content)
        
        print("Updated client.py to use IPv4")
        return True
    except Exception as e:
        print(f"Error updating client.py: {e}")
        return False

def fix_server_file():
    """Fix the server.py file to use IPv4 instead of IPv6"""
    server_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
    
    try:
        with open(server_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Replace IPv6 with IPv4 in host definition
        content = content.replace("host = '::'", "host = '127.0.0.1'")
        content = content.replace("# IPv6 wildcard", "# IPv4 localhost")
        
        # Replace socket creation
        content = content.replace("socket.AF_INET6", "socket.AF_INET")
        
        # Fix binding
        content = content.replace("server.bind((host, port, 0, 0))", "server.bind((host, port))")
        
        with open(server_path, 'w', encoding='utf-8') as file:
            file.write(content)
        
        print("Updated server.py to use IPv4")
        return True
    except Exception as e:
        print(f"Error updating server.py: {e}")
        return False

def create_backup(file_path):
    """Create a backup of a file"""
    try:
        backup_path = file_path + ".bak"
        with open(file_path, 'r', encoding='utf-8') as src:
            with open(backup_path, 'w', encoding='utf-8') as dst:
                dst.write(src.read())
        print(f"Created backup: {backup_path}")
        return True
    except Exception as e:
        print(f"Error creating backup: {e}")
        return False

if __name__ == "__main__":
    print("Chat Application Connection Fixer")
    print("=================================")
    print("This script will update your chat application to use IPv4 instead of IPv6.")
    print("This should fix connection issues between the client and server.")
    
    # Create backups first
    client_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "client.py")
    server_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
    
    create_backup(client_path)
    create_backup(server_path)
    
    # Fix the files
    client_fixed = fix_client_file()
    server_fixed = fix_server_file()
    
    if client_fixed and server_fixed:
        print("\nSuccess! Both files have been updated to use IPv4.")
        print("\nNext steps:")
        print("1. Restart the server: python server.py")
        print("2. Start the client: python client.py")
    else:
        print("\nThere were some errors. Please check the messages above.")