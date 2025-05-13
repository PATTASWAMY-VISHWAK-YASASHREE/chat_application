import socket
import threading
import tkinter as tk
import json
import base64
import os
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from tkinter import scrolledtext, messagebox, ttk, colorchooser, font, simpledialog

# Connection settings
host = '127.0.0.1'  # IPv4 localhost
port = 5054  # Updated to match server's new port

# Encryption settings
RSA_KEY_SIZE = 2048
AES_KEY_SIZE = 256

# Theme definitions
THEMES = {
    'default': {
        'bg': '#ffffff',
        'fg': '#000000',
        'chat_bg': '#f0f0f0',
        'chat_fg': '#000000',
        'button_bg': '#e1e1e1',
        'button_fg': '#000000',
        'highlight_bg': '#4a6ea9',
        'highlight_fg': '#ffffff',
        'font': ('Arial', 10)
    },
    'dark': {
        'bg': '#2d2d2d',
        'fg': '#ffffff',
        'chat_bg': '#383838',
        'chat_fg': '#ffffff',
        'button_bg': '#555555',
        'button_fg': '#ffffff',
        'highlight_bg': '#7289da',
        'highlight_fg': '#ffffff',
        'font': ('Arial', 10)
    },
    'light_blue': {
        'bg': '#e6f2ff',
        'fg': '#000000',
        'chat_bg': '#ffffff',
        'chat_fg': '#000000',
        'button_bg': '#b3d9ff',
        'button_fg': '#000000',
        'highlight_bg': '#3399ff',
        'highlight_fg': '#ffffff',
        'font': ('Arial', 10)
    },
    'forest': {
        'bg': '#e8f5e9',
        'fg': '#1b5e20',
        'chat_bg': '#ffffff',
        'chat_fg': '#1b5e20',
        'button_bg': '#a5d6a7',
        'button_fg': '#1b5e20',
        'highlight_bg': '#4caf50',
        'highlight_fg': '#ffffff',
        'font': ('Arial', 10)
    },
    'sunset': {
        'bg': '#fff8e1',
        'fg': '#bf360c',
        'chat_bg': '#ffffff',
        'chat_fg': '#bf360c',
        'button_bg': '#ffcc80',
        'button_fg': '#bf360c',
        'highlight_bg': '#ff9800',
        'highlight_fg': '#ffffff',
        'font': ('Arial', 10)
    }
}

class ChatClient:
    def __init__(self, root, auto_username=None):
        self.root = root
        self.root.title("Chat Application")
        self.root.geometry("900x700")
        self.root.resizable(True, True)
        
        # Auto-connect with username if provided
        self.auto_username = auto_username
        
        # Current theme
        self.current_theme = 'default'
        
        # Private messaging variables
        self.active_users = []
        self.selected_user = None
        self.private_mode = False
        
        # Encryption keys
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=RSA_KEY_SIZE,
            backend=default_backend()
        )
        self.public_key = self.private_key.public_key()
        self.user_public_keys = {}  # Store other users' public keys
        
        # Create menu bar
        self.menu_bar = tk.Menu(root)
        self.root.config(menu=self.menu_bar)
        
        # Settings menu
        self.settings_menu = tk.Menu(self.menu_bar, tearoff=0)
        self.menu_bar.add_cascade(label="Settings", menu=self.settings_menu)
        
        # Theme submenu
        self.theme_menu = tk.Menu(self.settings_menu, tearoff=0)
        self.settings_menu.add_cascade(label="Theme", menu=self.theme_menu)
        
        # Add theme options
        for theme in THEMES:
            self.theme_menu.add_command(label=theme.capitalize(), 
                                       command=lambda t=theme: self.change_theme(t))
        
        # Font size submenu
        self.font_menu = tk.Menu(self.settings_menu, tearoff=0)
        self.settings_menu.add_cascade(label="Font Size", menu=self.font_menu)
        
        # Add font size options
        for size in [8, 10, 12, 14, 16]:
            self.font_menu.add_command(label=str(size), 
                                      command=lambda s=size: self.change_font_size(s))
        
        # Main content frame with users list and chat
        self.content_frame = tk.Frame(root)
        self.content_frame.pack(pady=10, padx=10, fill=tk.BOTH, expand=True)
        
        # Users list frame (left side)
        self.users_frame = tk.Frame(self.content_frame, width=200)
        self.users_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        
        # Users list label
        tk.Label(self.users_frame, text="Online Users:").pack(anchor=tk.W)
        
        # Users listbox with scrollbar
        self.users_list_frame = tk.Frame(self.users_frame)
        self.users_list_frame.pack(fill=tk.BOTH, expand=True)
        
        self.users_scrollbar = tk.Scrollbar(self.users_list_frame)
        self.users_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.users_listbox = tk.Listbox(self.users_list_frame, yscrollcommand=self.users_scrollbar.set)
        self.users_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.users_scrollbar.config(command=self.users_listbox.yview)
        
        # Bind double-click on user to start private chat
        self.users_listbox.bind("<Double-1>", self.select_user_for_private_chat)
        
        # Private chat button
        self.private_chat_button = tk.Button(self.users_frame, text="Start Private Chat", 
                                           command=self.start_private_chat)
        self.private_chat_button.pack(fill=tk.X, pady=5)
        
        # Return to public chat button
        self.public_chat_button = tk.Button(self.users_frame, text="Return to Public Chat", 
                                          command=self.return_to_public_chat)
        self.public_chat_button.pack(fill=tk.X)
        self.public_chat_button.config(state=tk.DISABLED)  # Initially disabled
        
        # Chat history display (right side)
        self.chat_frame = tk.Frame(self.content_frame)
        self.chat_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        # Chat mode indicator
        self.chat_mode_label = tk.Label(self.chat_frame, text="Public Chat", font=('Arial', 12, 'bold'))
        self.chat_mode_label.pack(anchor=tk.W, pady=(0, 5))
        
        self.chat_history = scrolledtext.ScrolledText(self.chat_frame, wrap=tk.WORD, state='disabled')
        self.chat_history.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)
        
        # Typing indicator label
        self.typing_label = tk.Label(root, text="", fg="gray", anchor=tk.W)
        self.typing_label.pack(padx=20, fill=tk.X)
        
        # Message input area
        self.input_frame = tk.Frame(root)
        self.input_frame.pack(pady=10, padx=10, fill=tk.X)
        
        self.message_input = tk.Entry(self.input_frame)
        self.message_input.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        self.message_input.bind("<Return>", self.send_message)
        # Add typing indicator events
        self.message_input.bind("<KeyRelease>", self.handle_typing)
        
        self.send_button = tk.Button(self.input_frame, text="Send", command=self.send_message)
        self.send_button.pack(side=tk.RIGHT)
        
        # Username input
        self.username_frame = tk.Frame(root)
        self.username_frame.pack(pady=10, padx=10, fill=tk.X)
        
        tk.Label(self.username_frame, text="Username:").pack(side=tk.LEFT)
        self.username_input = tk.Entry(self.username_frame)
        self.username_input.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        self.username_input.insert(0, "User")
        
        self.connect_button = tk.Button(self.username_frame, text="Connect", command=self.connect_to_server)
        self.connect_button.pack(side=tk.RIGHT)
        
        # Status bar
        self.status_bar = tk.Label(root, text="Not connected", bd=1, relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Socket and connection status
        self.client_socket = None
        self.connected = False
        
        # Typing indicator variables
        self.is_typing = False
        self.typing_timer = None
        self.typing_users = set()
        
        # Apply default theme
        self.apply_theme('default')
        
        # Set focus to username
        self.username_input.focus()
        
        # Protocol for closing the window
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Auto-connect if username is provided
        if self.auto_username:
            self.username_input.delete(0, tk.END)
            self.username_input.insert(0, self.auto_username)
            # Use after to give the UI time to initialize
            self.root.after(500, self.connect_to_server)
        
    def connect_to_server(self):
        if self.connected:
            self.update_chat_history("Already connected to server.")
            return
            
        username = self.username_input.get().strip()
        if not username:
            messagebox.showerror("Error", "Please enter a username")
            return
            
        # Create socket with IPv6 support
        self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        
        try:
            self.client_socket.connect((host, port))
            self.connected = True
            
            # Send username to server
            self.client_socket.send(f"USERNAME:{username}".encode('utf-8'))
            
            # Update UI
            self.connect_button.config(text="Disconnect", command=self.disconnect_from_server)
            self.update_chat_history(f"Connected to server at {host}:{port}")
            
            # Start thread to receive messages
            receive_thread = threading.Thread(target=self.receive_messages)
            receive_thread.daemon = True
            receive_thread.start()
            
        except Exception as e:
            self.update_chat_history(f"Failed to connect: {str(e)}")
            self.client_socket = None
            return
            
        username = self.username_input.get().strip()
        if not username:
            messagebox.showerror("Error", "Please enter a username")
            return
            
        # Create socket with IPv6 support
        self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        
        try:
            self.client_socket.connect((host, port))
            self.connected = True
            
            # Send username to server
            self.client_socket.send(f"USERNAME:{username}".encode('utf-8'))
            
            # Update UI
            self.connect_button.config(text="Disconnect", command=self.disconnect_from_server)
            self.update_chat_history(f"Connected to server at {host}:{port}")
            
            # Start thread to receive messages
            receive_thread = threading.Thread(target=self.receive_messages)
            receive_thread.daemon = True
            receive_thread.start()
            
        except Exception as e:
            self.update_chat_history(f"Failed to connect: {str(e)}")
            self.client_socket = None
    
    def disconnect_from_server(self):
        if self.client_socket:
            try:
                self.client_socket.close()
            except:
                pass
            finally:
                self.client_socket = None
                self.connected = False
                self.connect_button.config(text="Connect", command=self.connect_to_server)
                self.update_chat_history("Disconnected from server")
    
    def send_message(self, event=None):
        if not self.connected:
            self.update_chat_history("Not connected to server. Please connect first.")
            return
            
        message = self.message_input.get().strip()
        if message:
            try:
                username = self.username_input.get().strip()
                
                # Handle private message
                if self.private_mode and self.selected_user:
                    # Encrypt the message for the selected user
                    if self.selected_user in self.user_public_keys:
                        # Generate a random AES key for this message
                        aes_key = os.urandom(AES_KEY_SIZE // 8)
                        iv = os.urandom(16)  # 16 bytes for AES
                        
                        # Encrypt the message with AES
                        cipher = Cipher(algorithms.AES(aes_key), modes.CFB(iv), backend=default_backend())
                        encryptor = cipher.encryptor()
                        encrypted_message = encryptor.update(message.encode('utf-8')) + encryptor.finalize()
                        
                        # Encrypt the AES key with recipient's public key
                        recipient_public_key = self.user_public_keys[self.selected_user]
                        encrypted_key = recipient_public_key.encrypt(
                            aes_key,
                            padding.OAEP(
                                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                                algorithm=hashes.SHA256(),
                                label=None
                            )
                        )
                        
                        # Prepare the message package
                        message_package = {
                            "type": "private_message",
                            "sender": username,
                            "recipient": self.selected_user,
                            "encrypted_key": base64.b64encode(encrypted_key).decode('utf-8'),
                            "iv": base64.b64encode(iv).decode('utf-8'),
                            "encrypted_message": base64.b64encode(encrypted_message).decode('utf-8')
                        }
                        
                        # Send the encrypted message
                        self.client_socket.send(json.dumps(message_package).encode('utf-8'))
                        
                        # Display in our own chat (unencrypted for us)
                        self.update_chat_history(f"[Private to {self.selected_user}] You: {message}")
                    else:
                        self.update_chat_history(f"Cannot send private message: No public key for {self.selected_user}")
                        return
                else:
                    # Regular public message
                    full_message = f"{username}: {message}"
                    self.client_socket.send(full_message.encode('utf-8'))
                
                self.message_input.delete(0, tk.END)
                
                # Reset typing status when message is sent
                if self.is_typing:
                    self.is_typing = False
                    self.send_typing_status(False)
                    
                # Cancel any pending typing timer
                if self.typing_timer:
                    self.root.after_cancel(self.typing_timer)
                    self.typing_timer = None
            except Exception as e:
                self.update_chat_history(f"Failed to send message: {str(e)}")
                self.disconnect_from_server()
                
    def select_user_for_private_chat(self, event=None):
        """Handle double-click on a user in the list to start private chat"""
        if not self.users_listbox.curselection():
            return
            
        selected_index = self.users_listbox.curselection()[0]
        selected_user = self.users_listbox.get(selected_index)
        
        # Don't allow private chat with yourself
        if selected_user == self.username_input.get().strip():
            messagebox.showinfo("Private Chat", "You cannot start a private chat with yourself.")
            return
            
        self.selected_user = selected_user
        self.start_private_chat()
    
    def start_private_chat(self):
        """Start a private chat with the selected user"""
        if not self.selected_user:
            messagebox.showinfo("Private Chat", "Please select a user from the list first.")
            return
            
        # Request the public key if we don't have it
        if self.selected_user not in self.user_public_keys:
            self.request_public_key(self.selected_user)
            
        # Update UI to show we're in private mode
        self.private_mode = True
        self.chat_mode_label.config(text=f"Private Chat with {self.selected_user}")
        self.public_chat_button.config(state=tk.NORMAL)
        self.private_chat_button.config(state=tk.DISABLED)
        
        # Clear chat history for privacy
        self.chat_history.config(state='normal')
        self.chat_history.delete(1.0, tk.END)
        self.chat_history.config(state='disabled')
        
        self.update_chat_history(f"Started private chat with {self.selected_user}. Messages are end-to-end encrypted.")
    
    def return_to_public_chat(self):
        """Return to public chat mode"""
        self.private_mode = False
        self.selected_user = None
        self.chat_mode_label.config(text="Public Chat")
        self.public_chat_button.config(state=tk.DISABLED)
        self.private_chat_button.config(state=tk.NORMAL)
        
        # Clear chat history for privacy
        self.chat_history.config(state='normal')
        self.chat_history.delete(1.0, tk.END)
        self.chat_history.config(state='disabled')
        
        self.update_chat_history("Returned to public chat.")
    
    def update_users_list(self):
        """Update the list of active users"""
        self.users_listbox.delete(0, tk.END)
        for user in self.active_users:
            self.users_listbox.insert(tk.END, user)
    
    def request_public_key(self, username):
        """Request the public key of another user"""
        if not self.connected:
            return
            
        request = {
            "type": "public_key_request",
            "requester": self.username_input.get().strip(),
            "target": username
        }
        
        try:
            self.client_socket.send(json.dumps(request).encode('utf-8'))
            self.update_chat_history(f"Requesting encryption key from {username}...")
        except Exception as e:
            self.update_chat_history(f"Failed to request public key: {str(e)}")
    
    def send_public_key(self, requester):
        """Send our public key to another user who requested it"""
        if not self.connected:
            return
            
        # Serialize the public key to PEM format
        pem = self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode('utf-8')
        
        response = {
            "type": "public_key_response",
            "sender": self.username_input.get().strip(),
            "recipient": requester,
            "public_key": pem
        }
        
        try:
            self.client_socket.send(json.dumps(response).encode('utf-8'))
        except Exception as e:
            self.update_chat_history(f"Failed to send public key: {str(e)}")
    
    def handle_typing(self, event=None):
        """Handle typing events to send typing indicators"""
        if not self.connected:
            return
            
        # If user is typing and hasn't sent a typing indicator yet
        if self.message_input.get() and not self.is_typing:
            self.is_typing = True
            self.send_typing_status(True)
            
            # Set a timer to reset typing status after 2 seconds of inactivity
            if self.typing_timer:
                self.root.after_cancel(self.typing_timer)
            self.typing_timer = self.root.after(2000, self.reset_typing_status)
        
        # If input is empty, immediately reset typing status
        elif not self.message_input.get() and self.is_typing:
            self.reset_typing_status()
            
    def reset_typing_status(self):
        """Reset typing status after inactivity"""
        if self.is_typing:
            self.is_typing = False
            self.send_typing_status(False)
        self.typing_timer = None
        
    def send_typing_status(self, is_typing):
        """Send typing status to server"""
        if not self.connected:
            return
            
        try:
            username = self.username_input.get().strip()
            if is_typing:
                self.client_socket.send(f"TYPING:{username}".encode('utf-8'))
            else:
                self.client_socket.send(f"STOPPED_TYPING:{username}".encode('utf-8'))
        except Exception as e:
            self.update_chat_history(f"Failed to send typing status: {str(e)}")
            self.disconnect_from_server()
    
    def receive_messages(self):
        while self.connected:
            try:
                message = self.client_socket.recv(4096).decode('utf-8')  # Increased buffer size for encrypted messages
                if message:
                    # Try to parse as JSON first (for chat history, typing indicators, or private messages)
                    try:
                        data = json.loads(message)
                        message_type = data.get("type", "")
                        
                        if message_type == "history":
                            self.update_chat_history("=== CHAT HISTORY BY USER ===")
                            
                            # Display messages grouped by user in a table-like format
                            user_messages = data.get("userMessages", {})
                            if not user_messages:
                                self.update_chat_history("No chat history available.")
                            
                            for username, messages in user_messages.items():
                                # Create a header for each user's messages
                                self.update_chat_history(f"\n--- {username}'s Messages ---")
                                self.update_chat_history("| Timestamp           | Message")
                                self.update_chat_history("|--------------------|-----------------------")
                                
                                # Display each message in a table-like format
                                for msg in messages:
                                    formatted_msg = f"| {msg['timestamp']} | {msg['message']}"
                                    self.update_chat_history(formatted_msg)
                                
                            self.update_chat_history("\n=== END OF CHAT HISTORY ===")
                            
                        elif message_type == "typing":
                            # Handle typing indicator
                            username = data.get("username")
                            is_typing = data.get("isTyping", False)
                            
                            if is_typing:
                                # Add user to typing users set
                                self.typing_users.add(username)
                            else:
                                # Remove user from typing users set
                                if username in self.typing_users:
                                    self.typing_users.remove(username)
                            
                            # Update typing indicator display
                            self.update_typing_indicator()
                            
                        elif message_type == "user_list":
                            # Update the list of active users
                            self.active_users = data.get("users", [])
                            self.update_users_list()
                            
                        elif message_type == "public_key_request":
                            # Someone is requesting our public key
                            requester = data.get("requester")
                            self.send_public_key(requester)
                            
                        elif message_type == "public_key_response":
                            # Received someone's public key
                            sender = data.get("sender")
                            key_data = data.get("public_key")
                            
                            # Deserialize the public key
                            public_key = serialization.load_pem_public_key(
                                key_data.encode('utf-8'),
                                backend=default_backend()
                            )
                            
                            # Store the public key
                            self.user_public_keys[sender] = public_key
                            self.update_chat_history(f"Received encryption key from {sender}")
                            
                        elif message_type == "private_message":
                            # Handle private encrypted message
                            sender = data.get("sender")
                            recipient = data.get("recipient")
                            
                            # Only process if we're the intended recipient
                            if recipient == self.username_input.get().strip():
                                try:
                                    # Decrypt the AES key with our private key
                                    encrypted_key = base64.b64decode(data.get("encrypted_key"))
                                    iv = base64.b64decode(data.get("iv"))
                                    encrypted_message = base64.b64decode(data.get("encrypted_message"))
                                    
                                    aes_key = self.private_key.decrypt(
                                        encrypted_key,
                                        padding.OAEP(
                                            mgf=padding.MGF1(algorithm=hashes.SHA256()),
                                            algorithm=hashes.SHA256(),
                                            label=None
                                        )
                                    )
                                    
                                    # Decrypt the message with the AES key
                                    cipher = Cipher(algorithms.AES(aes_key), modes.CFB(iv), backend=default_backend())
                                    decryptor = cipher.decryptor()
                                    decrypted_message = decryptor.update(encrypted_message) + decryptor.finalize()
                                    
                                    # Display the decrypted message
                                    self.update_chat_history(f"[Private from {sender}] {decrypted_message.decode('utf-8')}")
                                    
                                    # If we're not already in a private chat with this sender, ask if we want to switch
                                    if not (self.private_mode and self.selected_user == sender):
                                        if messagebox.askyesno("Private Message", 
                                                              f"You received a private message from {sender}. Switch to private chat with them?"):
                                            self.selected_user = sender
                                            self.start_private_chat()
                                except Exception as e:
                                    self.update_chat_history(f"Error decrypting private message: {str(e)}")
                        else:
                            # Unknown JSON message type
                            self.update_chat_history(message)
                    except json.JSONDecodeError:
                        # Not JSON, treat as regular message
                        self.update_chat_history(message)
                else:
                    # Empty message means server closed connection
                    self.update_chat_history("Connection to server lost")
                    self.disconnect_from_server()
                    break
            except Exception as e:
                if self.connected:  # Only show error if we haven't manually disconnected
                    self.update_chat_history(f"Error receiving message: {str(e)}")
                    self.disconnect_from_server()
                break
                
    def update_typing_indicator(self):
        """Update the typing indicator label based on who is typing"""
        if not self.typing_users:
            self.typing_label.config(text="")
        elif len(self.typing_users) == 1:
            user = list(self.typing_users)[0]
            self.typing_label.config(text=f"{user} is typing...")
        else:
            users_text = ", ".join(list(self.typing_users))
            self.typing_label.config(text=f"{users_text} are typing...")
    
    def update_chat_history(self, message):
        self.chat_history.config(state='normal')
        self.chat_history.insert(tk.END, message + "\n")
        self.chat_history.see(tk.END)  # Scroll to the end
        self.chat_history.config(state='disabled')
    
    def apply_theme(self, theme_name):
        """Apply the selected theme to all UI elements"""
        if theme_name not in THEMES:
            theme_name = 'default'
            
        theme = THEMES[theme_name]
        self.current_theme = theme_name
        
        # Apply theme to main window
        self.root.config(bg=theme['bg'])
        
        # Apply to frames
        self.chat_frame.config(bg=theme['bg'])
        self.input_frame.config(bg=theme['bg'])
        self.username_frame.config(bg=theme['bg'])
        
        # Apply to chat history
        self.chat_history.config(
            bg=theme['chat_bg'],
            fg=theme['chat_fg'],
            font=theme['font']
        )
        
        # Apply to typing indicator
        self.typing_label.config(
            bg=theme['bg'],
            fg='gray',  # Keep typing indicator gray for visibility
            font=theme['font']
        )
        
        # Apply to input fields
        self.message_input.config(
            bg=theme['chat_bg'],
            fg=theme['chat_fg'],
            insertbackground=theme['chat_fg'],  # Cursor color
            font=theme['font']
        )
        
        self.username_input.config(
            bg=theme['chat_bg'],
            fg=theme['chat_fg'],
            insertbackground=theme['chat_fg'],
            font=theme['font']
        )
        
        # Apply to buttons
        self.send_button.config(
            bg=theme['button_bg'],
            fg=theme['button_fg'],
            activebackground=theme['highlight_bg'],
            activeforeground=theme['highlight_fg'],
            font=theme['font']
        )
        
        self.connect_button.config(
            bg=theme['button_bg'],
            fg=theme['button_fg'],
            activebackground=theme['highlight_bg'],
            activeforeground=theme['highlight_fg'],
            font=theme['font']
        )
        
        # Apply to labels
        for label in self.username_frame.winfo_children():
            if isinstance(label, tk.Label):
                label.config(
                    bg=theme['bg'],
                    fg=theme['fg'],
                    font=theme['font']
                )
        
        # Apply to status bar
        self.status_bar.config(
            bg=theme['bg'],
            fg=theme['fg'],
            font=theme['font']
        )
        
    def change_theme(self, theme_name):
        """Change the current theme"""
        self.apply_theme(theme_name)
        
    def change_font_size(self, size):
        """Change font size for all elements"""
        theme = THEMES[self.current_theme]
        new_font = (theme['font'][0], size)
        
        # Update font in theme
        theme['font'] = new_font
        
        # Re-apply theme to update font sizes
        self.apply_theme(self.current_theme)
        
    def on_closing(self):
        if self.connected:
            self.disconnect_from_server()
        self.root.destroy()

def main():
    root = tk.Tk()
    
    # Generate a random username if launched from multi-client script
    import random
    import os
    
    # Check if this is being launched from the multi-client script
    if len(sys.argv) > 1 and sys.argv[1] == "--auto":
        # Get the index from command line if provided
        index = 0
        if len(sys.argv) > 2:
            try:
                index = int(sys.argv[2])
            except ValueError:
                pass
                
        # List of predefined usernames
        usernames = ["Alice", "Bob", "Charlie", "David", "Eva", 
                    "Frank", "Grace", "Hannah", "Ivan", "Julia"]
        
        # Use a predefined username or generate one
        if index < len(usernames):
            username = usernames[index]
        else:
            username = f"User{random.randint(1000, 9999)}"
            
        app = ChatClient(root)
        # Set the username
        app.username_input.delete(0, tk.END)
        app.username_input.insert(0, username)
        # Auto-connect after a short delay
        root.after(500, app.connect_to_server)
    else:
        # Normal launch
        app = ChatClient(root)
    
    # Position windows in a cascade if multiple clients
    if len(sys.argv) > 2:
        try:
            index = int(sys.argv[2])
            # Offset each window by 30 pixels
            x_offset = 100 + (index * 30)
            y_offset = 100 + (index * 30)
            root.geometry(f"+{x_offset}+{y_offset}")
        except ValueError:
            pass
    
    root.mainloop()

if __name__ == "__main__":
    import sys
    main()