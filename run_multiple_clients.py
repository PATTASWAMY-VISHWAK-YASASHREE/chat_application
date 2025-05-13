#!/usr/bin/env python3
"""
Script to launch multiple chat clients automatically.
This script prompts the user for the number of clients to launch.
"""

import subprocess
import sys
import time
import os

def main():
    """Launch multiple instances of the chat client based on user input"""
    # Ask the user how many clients to launch
    try:
        num_clients = int(input("How many chat clients would you like to launch? (1-10): "))
        if num_clients < 1 or num_clients > 10:
            print("Please enter a number between 1 and 10.")
            return
    except ValueError:
        print("Please enter a valid number.")
        return
    
    # Get the path to the client script
    client_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "client.py")
    
    print(f"Launching {num_clients} chat clients...")
    
    # Launch the clients with a slight delay between each
    processes = []
    for i in range(num_clients):
        # Use sys.executable to ensure we use the same Python interpreter
        cmd = [sys.executable, client_script, "--auto", str(i)]
        
        # Start the process
        print(f"Starting client {i+1}")
        proc = subprocess.Popen(cmd)
        processes.append(proc)
        
        # Add a small delay to prevent all clients from connecting simultaneously
        time.sleep(0.5)
    
    print(f"Successfully launched {num_clients} chat clients")
    
    # Keep the script running until user presses Ctrl+C
    try:
        print("Press Ctrl+C to terminate all clients")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nTerminating all clients...")
        for proc in processes:
            try:
                proc.terminate()
            except:
                pass
        print("All clients terminated")

if __name__ == "__main__":
    main()