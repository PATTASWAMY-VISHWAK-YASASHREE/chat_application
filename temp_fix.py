#!/usr/bin/env python3
"""
Quick fix script to update IPv6 to IPv4 in client.py and server.py
"""

import os
import re

def fix_client_file():
    """Fix the client.py file to use IPv4 instead of IPv6"""
    client_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "client.py")
    
    with open(client_path, 'r') as file:
        content = file.read()
    
    # Replace IPv6 with IPv4
    content = content.replace("host = '::1'", "host = '127.0.0.1'")
    content = content.replace("socket.AF_INET6", "socket.AF_INET")
    
    with open(client_path, 'w') as file:
        file.write(content)
    
    print("Updated client.py to use IPv4")

def fix_server_file():
    """Fix the server.py file to use IPv4 instead of IPv6"""
    server_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")
    
    with open(server_path, 'r') as file:
        content = file.read()
    
    # Replace IPv6 with IPv4
    content = content.replace("host = '::'", "host = '127.0.0.1'")
    content = content.replace("socket.AF_INET6", "socket.AF_INET")
    content = content.replace("server.bind((host, port, 0, 0))", "server.bind((host, port))")
    
    with open(server_path, 'w') as file:
        file.write(content)
    
    print("Updated server.py to use IPv4")

if __name__ == "__main__":
    fix_client_file()
    fix_server_file()
    print("Done! Both files have been updated to use IPv4 instead of IPv6.")
    print("Please restart the server and client applications.")