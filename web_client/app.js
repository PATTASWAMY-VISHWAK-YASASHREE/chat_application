// Galaxy Chat Application JavaScript

// DOM Elements
const usernameInput = document.getElementById('username-input');
const connectBtn = document.getElementById('connect-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const userList = document.getElementById('user-list');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');
const chatTitle = document.getElementById('chat-title');
const returnPublicBtn = document.getElementById('return-public-btn');
const themeSelect = document.getElementById('theme-select');
const encryptionModal = new bootstrap.Modal(document.getElementById('encryption-modal'));
const encryptionProgress = document.getElementById('encryption-progress');
const permissionModal = new bootstrap.Modal(document.getElementById('permission-modal'));
const permissionReason = document.getElementById('permission-reason');
const sendRequestBtn = document.getElementById('send-request-btn');
const waitingModal = new bootstrap.Modal(document.getElementById('waiting-modal'));
const adminPanel = document.getElementById('admin-panel');
const pendingRequests = document.getElementById('pending-requests');

// Connection settings
const host = '127.0.0.1';
const port = 5059;

// Chat state
let socket = null;
let connected = false;
let username = '';
let privateMode = false;
let selectedUser = null;
let typingTimeout = null;
let isTyping = false;
let typingUsers = new Set();
let publicKey = null;
let privateKey = null;
let userPublicKeys = {};
let dbAvailable = false;
let isAdmin = false;
let pendingUsers = [];
let approvedUsers = [];

// Admin username (this would normally be stored securely)
const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = 'admin123'; // In a real app, use proper authentication

// Initialize the application
function init() {
    // Set up event listeners
    connectBtn.addEventListener('click', handleConnectClick);
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    messageInput.addEventListener('input', handleTyping);
    themeSelect.addEventListener('change', changeTheme);
    returnPublicBtn.addEventListener('click', returnToPublicChat);
    sendRequestBtn.addEventListener('click', sendPermissionRequest);
    
    // Apply space theme by default
    applyTheme('space');
    
    // Add server status indicator
    addSystemMessage("Server status: Checking connection...");
    
    // Check if there's a stored admin session
    checkAdminSession();
}

// Check if there's a stored admin session
function checkAdminSession() {
    const storedUsername = localStorage.getItem('chatUsername');
    const storedIsAdmin = localStorage.getItem('chatIsAdmin') === 'true';
    
    if (storedUsername && storedIsAdmin) {
        usernameInput.value = storedUsername;
        isAdmin = true;
        connectAsAdmin();
    }
}

// Connect as admin automatically
function connectAsAdmin() {
    username = usernameInput.value.trim();
    if (username === ADMIN_USERNAME) {
        connectToServer(true);
    }
}

// Handle connect button click
function handleConnectClick() {
    if (connected) {
        disconnectFromServer();
    } else {
        username = usernameInput.value.trim();
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        // Check if this is the admin
        if (username === ADMIN_USERNAME) {
            // Ask for admin password
            const password = prompt('Enter admin password:');
            if (password === ADMIN_PASSWORD) {
                isAdmin = true;
                localStorage.setItem('chatUsername', username);
                localStorage.setItem('chatIsAdmin', 'true');
                connectToServer(true);
            } else {
                alert('Invalid admin password');
            }
        } else {
            // Regular user needs permission
            if (approvedUsers.includes(username)) {
                // User is already approved
                connectToServer(false);
            } else {
                // Show permission request modal
                permissionModal.show();
            }
        }
    }
}

// Send permission request to admin
function sendPermissionRequest() {
    const reason = permissionReason.value.trim();
    if (!reason) {
        alert('Please provide a reason for your request');
        return;
    }
    
    // Hide permission modal and show waiting modal
    permissionModal.hide();
    waitingModal.show();
    
    // Connect to server to send request
    connectToServerForRequest(reason);
}

// Connect to server just to send a permission request
function connectToServerForRequest(reason) {
    try {
        // Create WebSocket connection
        const tempSocket = new WebSocket(`ws://${host}:${port}`);
        
        tempSocket.onopen = function() {
            // Send permission request
            const request = {
                type: 'permission_request',
                username: usernameInput.value.trim(),
                reason: reason,
                timestamp: new Date().toISOString()
            };
            
            tempSocket.send(JSON.stringify(request));
            
            // Close the connection after sending
            setTimeout(() => {
                tempSocket.close();
            }, 1000);
        };
        
        tempSocket.onerror = function(error) {
            waitingModal.hide();
            alert('Failed to send permission request. Please try again later.');
        };
        
    } catch (error) {
        waitingModal.hide();
        alert('Failed to connect to server. Please try again later.');
    }
}

// Connect to the chat server
function connectToServer(skipPermission = false) {
    // Disable the input and button during connection
    usernameInput.disabled = true;
    connectBtn.disabled = true;
    
    // Show encryption modal
    encryptionModal.show();
    
    // Generate encryption keys
    generateEncryptionKeys().then(() => {
        try {
            // Create WebSocket connection
            socket = new WebSocket(`ws://${host}:${port}`);
            
            // Set up event handlers
            socket.onopen = () => handleSocketOpen(skipPermission);
            socket.onmessage = handleSocketMessage;
            socket.onclose = handleSocketClose;
            socket.onerror = handleSocketError;
            
        } catch (error) {
            console.error('Connection error:', error);
            updateStatus(false, `Connection error: ${error.message}`);
            usernameInput.disabled = false;
            connectBtn.disabled = false;
            encryptionModal.hide();
        }
    });
}

// Generate RSA key pair for encryption
async function generateEncryptionKeys() {
    // Simulate key generation with progress updates
    for (let i = 0; i <= 100; i += 10) {
        encryptionProgress.style.width = `${i}%`;
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced delay for faster loading
    }
    
    // In a real implementation, we would use the Web Crypto API
    // For now, we'll use CryptoJS as a placeholder
    const keyPair = CryptoJS.lib.WordArray.random(256);
    publicKey = keyPair.toString();
    privateKey = keyPair.toString();
    
    return true;
}

// Handle WebSocket open event
function handleSocketOpen(skipPermission) {
    // Send username to server
    if (skipPermission) {
        socket.send(`USERNAME:${username}`);
        
        if (isAdmin) {
            // Send admin identification
            const adminData = {
                type: 'admin_auth',
                username: username
            };
            socket.send(JSON.stringify(adminData));
        }
        
        connected = true;
        
        // Update UI
        updateStatus(true, 'Connected');
        usernameInput.disabled = true;
        connectBtn.textContent = 'Disconnect';
        connectBtn.disabled = false;
        messageInput.disabled = false;
        sendBtn.disabled = false;
        
        // Show admin panel if admin
        if (isAdmin) {
            adminPanel.classList.remove('d-none');
        }
        
        // Hide encryption modal
        encryptionModal.hide();
        
        // Add message to chat
        addSystemMessage(`Connected to server at ${host}:${port}`);
    } else {
        // Send permission check
        const permissionCheck = {
            type: 'permission_check',
            username: username
        };
        socket.send(JSON.stringify(permissionCheck));
    }
}

// Handle WebSocket message event
function handleSocketMessage(event) {
    const message = event.data;
    
    // Check for server status message
    if (message.startsWith("Server status:")) {
        addSystemMessage(message);
        return;
    }
    
    // Check for typing indicators
    if (message.startsWith("TYPING:") || message.startsWith("STOPPED_TYPING:")) {
        handleTypingIndicator(message);
        return;
    }
    
    // Try to parse as JSON first
    try {
        const data = JSON.parse(message);
        
        // Handle different message types
        switch (data.type) {
            case 'settings':
                handleSettingsMessage(data);
                break;
            case 'user_list':
                handleUserListMessage(data);
                break;
            case 'history':
                handleHistoryMessage(data);
                break;
            case 'typing':
                handleTypingMessage(data);
                break;
            case 'public_key_request':
                handlePublicKeyRequest(data);
                break;
            case 'public_key_response':
                handlePublicKeyResponse(data);
                break;
            case 'private_message':
                handlePrivateMessage(data);
                break;
            case 'permission_response':
                handlePermissionResponse(data);
                break;
            case 'permission_request':
                handlePermissionRequest(data);
                break;
            case 'pending_requests':
                handlePendingRequests(data);
                break;
            default:
                // Unknown JSON message type
                addSystemMessage(message);
        }
    } catch (e) {
        // Not JSON, treat as regular message
        addChatMessage(message);
    }
}

// Handle permission response
function handlePermissionResponse(data) {
    waitingModal.hide();
    
    if (data.approved) {
        // User is approved
        approvedUsers.push(username);
        connectToServer(true);
        addSystemMessage("Your request has been approved. Welcome to the chat!");
    } else {
        // User is denied
        alert("Your request has been denied by the admin.");
        usernameInput.disabled = false;
        connectBtn.disabled = false;
    }
}

// Handle permission request (admin only)
function handlePermissionRequest(data) {
    if (!isAdmin) return;
    
    // Add to pending requests
    pendingUsers.push(data);
    
    // Update pending requests UI
    updatePendingRequestsUI();
    
    // Show notification
    addSystemMessage(`New permission request from ${data.username}`);
}

// Handle pending requests list
function handlePendingRequests(data) {
    if (!isAdmin) return;
    
    pendingUsers = data.requests || [];
    updatePendingRequestsUI();
}

// Update pending requests UI
function updatePendingRequestsUI() {
    if (!isAdmin) return;
    
    // Clear current requests
    pendingRequests.innerHTML = '';
    
    if (pendingUsers.length === 0) {
        pendingRequests.innerHTML = '<div class="text-center text-muted">No pending requests</div>';
        return;
    }
    
    // Add each request
    pendingUsers.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'request-item';
        
        const timestamp = new Date(request.timestamp).toLocaleTimeString();
        
        requestItem.innerHTML = `
            <div>
                <div class="username">${request.username}</div>
                <div class="timestamp">${timestamp}</div>
                <div class="reason">"${request.reason}"</div>
            </div>
            <div class="actions">
                <button class="btn btn-sm btn-approve" data-username="${request.username}">
                    <i class="bi bi-check-lg"></i>
                </button>
                <button class="btn btn-sm btn-deny" data-username="${request.username}">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        `;
        
        // Add event listeners
        const approveBtn = requestItem.querySelector('.btn-approve');
        const denyBtn = requestItem.querySelector('.btn-deny');
        
        approveBtn.addEventListener('click', () => approveUser(request.username));
        denyBtn.addEventListener('click', () => denyUser(request.username));
        
        pendingRequests.appendChild(requestItem);
    });
}

// Approve a user
function approveUser(username) {
    if (!isAdmin || !connected) return;
    
    const response = {
        type: 'permission_response',
        username: username,
        approved: true
    };
    
    socket.send(JSON.stringify(response));
    
    // Remove from pending users
    pendingUsers = pendingUsers.filter(req => req.username !== username);
    updatePendingRequestsUI();
    
    addSystemMessage(`Approved user: ${username}`);
}

// Deny a user
function denyUser(username) {
    if (!isAdmin || !connected) return;
    
    const response = {
        type: 'permission_response',
        username: username,
        approved: false
    };
    
    socket.send(JSON.stringify(response));
    
    // Remove from pending users
    pendingUsers = pendingUsers.filter(req => req.username !== username);
    updatePendingRequestsUI();
    
    addSystemMessage(`Denied user: ${username}`);
}

// Handle typing indicator messages directly
function handleTypingIndicator(message) {
    if (message.startsWith("TYPING:")) {
        const user = message.substring(7);
        if (user !== username) {
            typingUsers.add(user);
            updateTypingIndicator();
        }
    } else if (message.startsWith("STOPPED_TYPING:")) {
        const user = message.substring(15);
        if (user !== username) {
            typingUsers.delete(user);
            updateTypingIndicator();
        }
    }
}

// Handle settings message
function handleSettingsMessage(data) {
    // Apply theme if provided
    if (data.theme) {
        themeSelect.value = data.theme;
        applyTheme(data.theme);
    }
    
    // Store database availability
    if (data.dbAvailable !== undefined) {
        dbAvailable = data.dbAvailable;
        addSystemMessage(`Database ${dbAvailable ? 'connected' : 'not available'}`);
    }
}

// Handle user list message
function handleUserListMessage(data) {
    const users = data.users || [];
    
    // Clear current user list
    userList.innerHTML = '';
    
    // Add each user to the list
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        
        // Add admin badge if admin
        if (user === ADMIN_USERNAME) {
            userItem.classList.add('admin');
            userItem.innerHTML = `${user} <i class="bi bi-shield-fill"></i>`;
        } else {
            userItem.textContent = user;
        }
        
        userItem.dataset.username = user;
        
        // Don't allow private chat with yourself or with admin if you're not admin
        if (user !== username && (isAdmin || user !== ADMIN_USERNAME)) {
            // Add click event to start private chat
            userItem.addEventListener('click', () => {
                selectUserForPrivateChat(user);
            });
        }
        
        userList.appendChild(userItem);
    });
}

// Handle chat history message
function handleHistoryMessage(data) {
    addSystemMessage("=== CHAT HISTORY ===");
    
    const userMessages = data.userMessages || {};
    
    // Display messages for each user
    for (const [user, messages] of Object.entries(userMessages)) {
        addSystemMessage(`\n--- ${user}'s Messages ---`);
        
        messages.forEach(msg => {
            const formattedMessage = `${msg.username}: ${msg.message}`;
            addChatMessage(formattedMessage, msg.timestamp);
        });
    }
    
    addSystemMessage("=== END OF CHAT HISTORY ===");
}

// Handle typing indicator message
function handleTypingMessage(data) {
    const user = data.username;
    const isTyping = data.isTyping;
    
    if (user !== username) {
        if (isTyping) {
            typingUsers.add(user);
        } else {
            typingUsers.delete(user);
        }
        
        updateTypingIndicator();
    }
}

// Handle public key request
function handlePublicKeyRequest(data) {
    const requester = data.requester;
    
    // Send our public key to the requester
    const response = {
        type: 'public_key_response',
        sender: username,
        recipient: requester,
        public_key: publicKey
    };
    
    socket.send(JSON.stringify(response));
}

// Handle public key response
function handlePublicKeyResponse(data) {
    const sender = data.sender;
    const key = data.public_key;
    
    // Store the public key
    userPublicKeys[sender] = key;
    
    addSystemMessage(`Received encryption key from ${sender}`);
}

// Handle private message
function handlePrivateMessage(data) {
    const sender = data.sender;
    
    // Decrypt the message (simplified for this example)
    const decryptedMessage = `[Private from ${sender}] ${data.message || "Encrypted message"}`;
    
    addChatMessage(decryptedMessage, null, true);
    
    // If we're not already in a private chat with this sender, ask if we want to switch
    if (!(privateMode && selectedUser === sender)) {
        if (confirm(`You received a private message from ${sender}. Switch to private chat with them?`)) {
            selectUserForPrivateChat(sender);
        }
    }
}

// Handle WebSocket close event
function handleSocketClose() {
    if (connected) {
        addSystemMessage("Connection to server lost");
        disconnectFromServer();
    }
}

// Handle WebSocket error event
function handleSocketError(error) {
    console.error('WebSocket error:', error);
    addSystemMessage(`Connection error: ${error.message || 'Unknown error'}`);
    disconnectFromServer();
}

// Disconnect from the server
function disconnectFromServer() {
    if (socket) {
        socket.close();
    }
    
    connected = false;
    
    // Update UI
    updateStatus(false, 'Disconnected');
    usernameInput.disabled = false;
    connectBtn.textContent = 'Connect';
    connectBtn.disabled = false;
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    // Hide admin panel
    adminPanel.classList.add('d-none');
    
    // Clear user list
    userList.innerHTML = '';
    
    // Reset private chat state
    returnToPublicChat();
    
    // Hide typing indicator
    hideTypingIndicator();
    
    // Clear admin session if admin
    if (isAdmin) {
        localStorage.removeItem('chatUsername');
        localStorage.removeItem('chatIsAdmin');
        isAdmin = false;
    }
}

// Send a message
function sendMessage() {
    if (!connected) {
        addSystemMessage("Not connected to server. Please connect first.");
        return;
    }
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    try {
        if (privateMode && selectedUser) {
            // Send private message
            const privateMessage = {
                type: 'private_message',
                sender: username,
                recipient: selectedUser,
                message: message,
                encrypted: true
            };
            
            socket.send(JSON.stringify(privateMessage));
            
            // Display in our own chat
            addChatMessage(`[Private to ${selectedUser}] You: ${message}`, null, true);
        } else {
            // Send public message
            const fullMessage = `${username}: ${message}`;
            socket.send(fullMessage);
        }
        
        // Clear input
        messageInput.value = '';
        
        // Reset typing status
        if (isTyping) {
            isTyping = false;
            sendTypingStatus(false);
        }
        
        // Cancel any pending typing timer
        if (typingTimeout) {
            clearTimeout(typingTimeout);
            typingTimeout = null;
        }
        
    } catch (error) {
        addSystemMessage(`Failed to send message: ${error.message}`);
        disconnectFromServer();
    }
}

// Handle typing events
function handleTyping() {
    if (!connected) return;
    
    // If user is typing and hasn't sent a typing indicator yet
    if (messageInput.value && !isTyping) {
        isTyping = true;
        sendTypingStatus(true);
        
        // Set a timer to reset typing status after 2 seconds of inactivity
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        typingTimeout = setTimeout(resetTypingStatus, 2000);
    }
    
    // If input is empty, immediately reset typing status
    else if (!messageInput.value && isTyping) {
        resetTypingStatus();
    }
}

// Reset typing status
function resetTypingStatus() {
    if (isTyping) {
        isTyping = false;
        sendTypingStatus(false);
    }
    typingTimeout = null;
}

// Send typing status to server
function sendTypingStatus(isTyping) {
    if (!connected) return;
    
    try {
        if (isTyping) {
            socket.send(`TYPING:${username}`);
        } else {
            socket.send(`STOPPED_TYPING:${username}`);
        }
    } catch (error) {
        addSystemMessage(`Failed to send typing status: ${error.message}`);
        disconnectFromServer();
    }
}

// Update typing indicator display
function updateTypingIndicator() {
    if (!typingUsers.size) {
        hideTypingIndicator();
    } else if (typingUsers.size === 1) {
        const user = Array.from(typingUsers)[0];
        showTypingIndicator(`${user} is typing`);
    } else {
        const users = Array.from(typingUsers).join(', ');
        showTypingIndicator(`${users} are typing`);
    }
}

// Show typing indicator with animation
function showTypingIndicator(text) {
    typingText.textContent = text;
    typingIndicator.classList.add('visible');
}

// Hide typing indicator
function hideTypingIndicator() {
    typingIndicator.classList.remove('visible');
}

// Select a user for private chat
function selectUserForPrivateChat(user) {
    selectedUser = user;
    startPrivateChat();
}

// Start a private chat
function startPrivateChat() {
    if (!selectedUser) {
        alert('Please select a user from the list first.');
        return;
    }
    
    // Request the public key if we don't have it
    if (!userPublicKeys[selectedUser]) {
        requestPublicKey(selectedUser);
    }
    
    // Update UI to show we're in private mode
    privateMode = true;
    chatTitle.innerHTML = `<i class="bi bi-chat-square-text"></i> Private Chat with ${selectedUser}`;
    returnPublicBtn.classList.remove('d-none');
    
    // Highlight the selected user
    const userItems = userList.querySelectorAll('.user-item');
    userItems.forEach(item => {
        if (item.dataset.username === selectedUser) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Clear chat history for privacy
    chatMessages.innerHTML = '';
    
    // Re-add the typing indicator (it was removed when clearing chat history)
    chatMessages.appendChild(typingIndicator);
    
    addSystemMessage(`Started private chat with ${selectedUser}. Messages are end-to-end encrypted.`);
}

// Return to public chat
function returnToPublicChat() {
    privateMode = false;
    selectedUser = null;
    chatTitle.innerHTML = `<i class="bi bi-chat-square-text"></i> Public Chat`;
    returnPublicBtn.classList.add('d-none');
    
    // Remove highlight from all users
    const userItems = userList.querySelectorAll('.user-item');
    userItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Clear chat history for privacy
    chatMessages.innerHTML = '';
    
    // Re-add the typing indicator (it was removed when clearing chat history)
    chatMessages.appendChild(typingIndicator);
    
    addSystemMessage('Returned to public chat.');
}

// Request the public key of another user
function requestPublicKey(username) {
    if (!connected) return;
    
    const request = {
        type: 'public_key_request',
        requester: username,
        target: username
    };
    
    try {
        socket.send(JSON.stringify(request));
        addSystemMessage(`Requesting encryption key from ${username}...`);
    } catch (error) {
        addSystemMessage(`Failed to request public key: ${error.message}`);
    }
}

// Add a system message to the chat
function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = text;
    
    // Make sure typing indicator stays at the bottom
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl && typingEl.parentNode === chatMessages) {
        chatMessages.insertBefore(messageDiv, typingEl);
    } else {
        chatMessages.appendChild(messageDiv);
        // Re-add typing indicator if it was removed
        chatMessages.appendChild(typingIndicator);
    }
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add a chat message to the display
function addChatMessage(text, timestamp = null, isPrivate = false) {
    // Determine if this is an outgoing or incoming message
    const isOutgoing = text.startsWith(`${username}:`);
    const isAdminMessage = text.startsWith(`${ADMIN_USERNAME}:`);
    
    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
    
    if (isPrivate) {
        messageDiv.classList.add('message-private');
    }
    
    if (isAdminMessage) {
        messageDiv.classList.add('message-admin');
    }
    
    // Add message content
    messageDiv.textContent = text;
    
    // Add timestamp if provided
    if (timestamp) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = timestamp;
        messageDiv.appendChild(timeDiv);
    }
    
    // Make sure typing indicator stays at the bottom
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl && typingEl.parentNode === chatMessages) {
        chatMessages.insertBefore(messageDiv, typingEl);
    } else {
        chatMessages.appendChild(messageDiv);
        // Re-add typing indicator if it was removed
        chatMessages.appendChild(typingIndicator);
    }
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update connection status display
function updateStatus(isConnected, statusMessage) {
    statusIndicator.className = isConnected ? 'status-indicator status-online' : 'status-indicator status-offline';
    statusText.textContent = statusMessage;
}

// Apply theme to the UI
function applyTheme(themeName) {
    // Remove all theme classes
    document.body.classList.remove('theme-dark', 'theme-light-blue', 'theme-forest', 'theme-sunset');
    
    // Add the selected theme class
    if (themeName !== 'space') {
        document.body.classList.add(`theme-${themeName}`);
    }
}

// Change the current theme
function changeTheme() {
    const themeName = themeSelect.value;
    applyTheme(themeName);
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);