// Simple server.js
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Server type and port configuration
const SERVER_TYPE = process.argv[2] === 'admin' ? 'admin' : 'user';
const PORT = SERVER_TYPE === 'admin' ? 5059 : 5000;

console.log(`Starting ${SERVER_TYPE} server on port ${PORT}`);

// Create HTTP server
const httpServer = http.createServer((req, res) => {
    console.log(`Request received: ${req.url}`);
    
    // Serve index.html for root path
    let filePath;
    if (req.url === '/' || req.url === '/index.html') {
        filePath = path.join(__dirname, 'index.html');
        console.log(`Serving index.html from ${filePath}`);
    } else {
        filePath = path.join(__dirname, req.url);
    }
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log(`File not found: ${filePath}`);
            res.writeHead(404);
            res.end('404 Not Found');
            return;
        }
        
        // Read and serve the file
        fs.readFile(filePath, (err, content) => {
            if (err) {
                console.log(`Error reading file: ${err}`);
                res.writeHead(500);
                res.end('500 Server Error');
                return;
            }
            
            // Determine content type
            let contentType = 'text/html';
            const ext = path.extname(filePath);
            if (ext === '.css') contentType = 'text/css';
            if (ext === '.js') contentType = 'text/javascript';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
            console.log(`Successfully served ${filePath}`);
        });
    });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server: httpServer });

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log(`New client connected to ${SERVER_TYPE} server`);
    
    // Handle messages
    ws.on('message', (message) => {
        const messageStr = message.toString();
        console.log(`Received on ${SERVER_TYPE} server: ${messageStr}`);
        
        // Echo back the message for testing
        ws.send(`Echo from ${SERVER_TYPE} server: ${messageStr}`);
    });
    
    // Handle disconnection
    ws.on('close', () => {
        console.log(`Client disconnected from ${SERVER_TYPE} server`);
    });
});

// Start the server
httpServer.listen(PORT, () => {
    console.log(`${SERVER_TYPE} server running on http://localhost:${PORT}`);
    console.log(`Open your browser to http://localhost:${PORT} to view the chat application`);
});// Try to connect to the database
async function checkDatabaseConnection() {
    console.log(`${logStyles.bright}${logStyles.fg.cyan}[DATABASE]${logStyles.reset} Attempting to connect to PostgreSQL database...`);
    console.log(`${logStyles.dim}Host: ${config.DB_CONFIG.host}, Database: ${config.DB_CONFIG.database}, User: ${config.DB_CONFIG.user}${logStyles.reset}`);
    
    const pool = new Pool(config.DB_CONFIG);
    try {
        const client = await pool.connect();
        
        // Test query to verify connection
        const result = await client.query('SELECT version()');
        const pgVersion = result.rows[0].version;
        
        console.log(`${logStyles.bright}${logStyles.fg.green}[DATABASE]${logStyles.reset} Connection successful!`);
        console.log(`${logStyles.fg.green}PostgreSQL version: ${pgVersion}${logStyles.reset}`);
        console.log(`${logStyles.bright}${logStyles.fg.green}[DATABASE]${logStyles.reset} Message persistence enabled`);
        
        client.release();
        dbAvailable = true;
        return true;
    } catch (err) {
        console.log(`${logStyles.bright}${logStyles.fg.red}[DATABASE]${logStyles.reset} Connection failed: ${err.message}`);
        console.log(`${logStyles.bright}${logStyles.fg.yellow}[DATABASE]${logStyles.reset} Running in no-database mode`);
        console.log(`${logStyles.fg.yellow}Messages will not be persisted${logStyles.reset}`);
        dbAvailable = false;
        return false;
    } finally {
        await pool.end();
    }
}

// Save message to database
async function saveMessageToDatabase(username, message, messageType = 'text', isPrivate = false, recipient = null) {
    if (!dbAvailable) return;
    
    const pool = new Pool(config.DB_CONFIG);
    try {
        const client = await pool.connect();
        
        // Get user ID
        const userResult = await client.query(
            'SELECT id FROM chat_users WHERE username = $1',
            [username]
        );
        
        let userId;
        if (userResult.rows.length > 0) {
            userId = userResult.rows[0].id;
        } else {
            // Create user
            const newUserResult = await client.query(
                'INSERT INTO chat_users (username, last_seen) VALUES ($1, NOW()) RETURNING id',
                [username]
            );
            userId = newUserResult.rows[0].id;
            console.log(`${logStyles.fg.cyan}[DB]${logStyles.reset} Created new user: ${username}`);
        }
        
        // Get recipient ID if private message
        let recipientId = null;
        if (isPrivate && recipient) {
            const recipientResult = await client.query(
                'SELECT id FROM chat_users WHERE username = $1',
                [recipient]
            );
            
            if (recipientResult.rows.length > 0) {
                recipientId = recipientResult.rows[0].id;
            } else {
                // Create recipient user
                const newRecipientResult = await client.query(
                    'INSERT INTO chat_users (username, last_seen) VALUES ($1, NOW()) RETURNING id',
                    [recipient]
                );
                recipientId = newRecipientResult.rows[0].id;
                console.log(`${logStyles.fg.cyan}[DB]${logStyles.reset} Created new user: ${recipient}`);
            }
        }
        
        // Save message
        await client.query(
            'INSERT INTO chat_messages (sender_id, message, timestamp, message_type, is_private, recipient_id) VALUES ($1, $2, NOW(), $3, $4, $5)',
            [userId, message, messageType, isPrivate, recipientId]
        );
        
        client.release();
    } catch (err) {
        console.error(`${logStyles.fg.red}[DB ERROR]${logStyles.reset} Error saving message to database: ${err}`);
    } finally {
        await pool.end();
    }
}// Create HTTP server
const server = http.createServer((req, res) => {
    // Handle bridge requests for cross-server communication
    if (req.url === '/bridge' && req.method === 'POST') {
        bridge.handleBridgeRequest(req, res, SERVER_TYPE, handleBridgeMessage);
        return;
    }
    
    console.log(`${logStyles.fg.cyan}${new Date().toISOString()} - ${req.method} ${req.url}${logStyles.reset}`);
    
    // Serve static files
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    
    // Set content type
    const contentType = MIME_TYPES[extname] || 'text/plain';
    
    // Read file
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // File not found
                res.writeHead(404);
                res.end('404 Not Found');
                console.log(`${logStyles.fg.red}404 Not Found: ${filePath}${logStyles.reset}`);
            } else {
                // Server error
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
                console.log(`${logStyles.fg.red}500 Server Error: ${err.code}${logStyles.reset}`);
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server: httpServer });

// Process messages serially
async function processMessageQueue() {
    if (processingMessage || messageQueue.length === 0) return;
    
    processingMessage = true;
    const { message, sender, callback } = messageQueue.shift();
    
    try {
        // Process the message
        await handleMessage(message, sender);
        if (callback) callback();
    } catch (error) {
        console.error(`${logStyles.fg.red}Error processing message: ${error}${logStyles.reset}`);
    } finally {
        processingMessage = false;
        // Process next message if any
        processMessageQueue();
    }
}

// Handle bridge messages from other servers
async function handleBridgeMessage(message) {
    console.log(`${logStyles.bright}${logStyles.fg.blue}[BRIDGE]${logStyles.reset} Received cross-server message: ${message.type}`);
    
    switch (message.type) {
        case 'permission_request':
            // Forward permission request to admin
            if (SERVER_TYPE === 'admin') {
                pendingRequests.push(message.data);
                
                // Send to admin if connected
                if (adminClient && adminClient.readyState === WebSocket.OPEN) {
                    adminClient.send(JSON.stringify({
                        type: 'permission_request',
                        ...message.data
                    }));
                }
                
                return { success: true, message: 'Request forwarded to admin' };
            }
            break;
            
        case 'permission_response':
            // Forward permission response to user server
            if (SERVER_TYPE === 'user') {
                const { username, approved } = message.data;
                
                if (approved) {
                    // Add to approved users
                    if (!approvedUsers.includes(username)) {
                        approvedUsers.push(username);
                    }
                }
                
                // Broadcast to all clients so the user can connect
                broadcastMessage(JSON.stringify({
                    type: 'permission_response',
                    username: username,
                    approved: approved
                }), null);
                
                return { success: true, message: 'Response processed' };
            }
            break;
            
        case 'chat_message':
            // Forward chat message to appropriate server
            broadcastMessage(JSON.stringify(message.data), null);
            return { success: true, message: 'Message broadcasted' };
            
        default:
            return { success: false, message: 'Unknown message type' };
    }
    
    return { success: false, message: 'Message not handled by this server type' };
}// Handle a message
async function handleMessage(messageStr, ws) {
    console.log(`${logStyles.fg.yellow}Processing: ${messageStr}${logStyles.reset}`);
    
    // Handle username registration
    if (messageStr.startsWith("USERNAME:")) {
        const username = messageStr.substring(9);
        
        // Check if this is the admin
        if (username === ADMIN_USERNAME) {
            // Only allow admin on admin server
            if (SERVER_TYPE !== 'admin') {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Admin login is only allowed on the admin server (port ' + config.ADMIN_PORT + ')'
                }));
                ws.close();
                return;
            }
            
            if (adminConnected) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'An admin is already connected'
                }));
                ws.close();
                return;
            }
            
            adminClient = ws;
            adminConnected = true;
            console.log(`${logStyles.bright}${logStyles.fg.yellow}[ADMIN]${logStyles.reset} Admin connected`);
        }
        
        // Check if user is approved or is admin
        if (username === ADMIN_USERNAME || approvedUsers.includes(username)) {
            clientUsernames.set(ws, username);
            activeClients.push(ws);
            
            // Notify all clients about the new connection
            const joinMessage = `${username} has joined the chat!`;
            broadcastMessage(joinMessage, ws);
            
            // Send welcome message to the new client
            ws.send(`Welcome to the chat, ${username}!`);
            
            // Send database status
            ws.send(`Server status: ${dbAvailable ? 'Database connected' : 'Running without database'}`);
            
            // Send user settings
            const settings = {
                type: 'settings',
                theme: 'space',
                username: username,
                dbAvailable: dbAvailable,
                serverType: SERVER_TYPE
            };
            ws.send(JSON.stringify(settings));
            
            // Send list of active users to all clients
            broadcastUserList();
            
            // If this is the admin, send pending requests
            if (username === ADMIN_USERNAME) {
                sendPendingRequestsToAdmin();
            }
            
            console.log(`${logStyles.bright}${logStyles.fg.green}[USER]${logStyles.reset} ${username} connected`);
        } else {
            // User not approved
            ws.send(JSON.stringify({
                type: 'permission_response',
                approved: false,
                message: 'You need permission to join this chat'
            }));
            
            // Close the connection
            ws.close();
        }
        
        return;
    }
    
    // Handle admin login
    if (messageStr.startsWith('{"type":"admin_login"')) {
        try {
            const data = JSON.parse(messageStr);
            
            // Only allow admin login on admin server
            if (SERVER_TYPE !== 'admin') {
                ws.send(JSON.stringify({
                    type: 'admin_login_response',
                    success: false,
                    message: 'Admin login is only allowed on the admin server (port ' + config.ADMIN_PORT + ')'
                }));
                return;
            }
            
            if (data.username === ADMIN_USERNAME && data.password === ADMIN_PASSWORD) {
                if (adminConnected) {
                    ws.send(JSON.stringify({
                        type: 'admin_login_response',
                        success: false,
                        message: 'An admin is already connected'
                    }));
                    return;
                }
                
                // Set as admin
                adminClient = ws;
                adminConnected = true;
                clientUsernames.set(ws, ADMIN_USERNAME);
                activeClients.push(ws);
                
                // Send success response
                ws.send(JSON.stringify({
                    type: 'admin_login_response',
                    success: true
                }));
                
                console.log(`${logStyles.bright}${logStyles.fg.yellow}[ADMIN]${logStyles.reset} Admin authenticated`);
                
                // Send welcome message
                ws.send(`Welcome to the chat, ${ADMIN_USERNAME}!`);
                
                // Send database status
                ws.send(`Server status: ${dbAvailable ? 'Database connected' : 'Running without database'}`);
                
                // Send user settings
                const settings = {
                    type: 'settings',
                    theme: 'space',
                    username: ADMIN_USERNAME,
                    dbAvailable: dbAvailable,
                    serverType: SERVER_TYPE
                };
                ws.send(JSON.stringify(settings));
                
                // Send list of active users
                broadcastUserList();
                
                // Send pending requests
                sendPendingRequestsToAdmin();
                
                // Notify all clients
                broadcastMessage(`${ADMIN_USERNAME} has joined the chat!`, ws);
            } else {
                ws.send(JSON.stringify({
                    type: 'admin_login_response',
                    success: false,
                    message: 'Invalid admin credentials'
                }));
            }
        } catch (e) {
            console.error(`${logStyles.fg.red}Error parsing admin login: ${e}${logStyles.reset}`);
        }
        return;
    }    // Handle permission check
    if (messageStr.startsWith('{"type":"permission_check"')) {
        try {
            const data = JSON.parse(messageStr);
            const username = data.username;
            
            // Check if user is approved
            if (approvedUsers.includes(username)) {
                ws.send(JSON.stringify({
                    type: 'permission_response',
                    approved: true
                }));
            } else {
                ws.send(JSON.stringify({
                    type: 'permission_response',
                    approved: false,
                    message: 'You need permission to join this chat'
                }));
            }
        } catch (e) {
            console.error(`${logStyles.fg.red}Error parsing permission check: ${e}${logStyles.reset}`);
        }
        return;
    }
    
    // Handle permission request
    if (messageStr.startsWith('{"type":"permission_request"')) {
        try {
            const data = JSON.parse(messageStr);
            const username = data.username;
            const reason = data.reason;
            
            console.log(`${logStyles.bright}${logStyles.fg.magenta}[REQUEST]${logStyles.reset} Permission request from ${username}: ${reason}`);
            
            // If this is the admin server, handle directly
            if (SERVER_TYPE === 'admin') {
                // Add to pending requests
                pendingRequests.push(data);
                
                // Send to admin if connected
                if (adminClient && adminClient.readyState === WebSocket.OPEN) {
                    adminClient.send(JSON.stringify({
                        type: 'permission_request',
                        ...data
                    }));
                }
            } 
            // If this is the user server, forward to admin server
            else {
                try {
                    await bridge.sendToAdmin({
                        type: 'permission_request',
                        data: data
                    });
                    console.log(`${logStyles.bright}${logStyles.fg.blue}[BRIDGE]${logStyles.reset} Permission request forwarded to admin server`);
                } catch (err) {
                    console.error(`${logStyles.fg.red}Error forwarding permission request: ${err}${logStyles.reset}`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Could not forward permission request to admin server'
                    }));
                }
            }
        } catch (e) {
            console.error(`${logStyles.fg.red}Error parsing permission request: ${e}${logStyles.reset}`);
        }
        return;
    }
    
    // Handle permission response (from admin)
    if (messageStr.startsWith('{"type":"permission_response"')) {
        try {
            const data = JSON.parse(messageStr);
            const username = data.username;
            const approved = data.approved;
            
            console.log(`${logStyles.bright}${logStyles.fg.magenta}[RESPONSE]${logStyles.reset} Permission ${approved ? 'approved' : 'denied'} for ${username}`);
            
            if (approved) {
                // Add to approved users
                if (!approvedUsers.includes(username)) {
                    approvedUsers.push(username);
                }
                
                // Remove from pending requests
                const index = pendingRequests.findIndex(req => req.username === username);
                if (index !== -1) {
                    pendingRequests.splice(index, 1);
                }
            }
            
            // If this is the admin server, forward to user server
            if (SERVER_TYPE === 'admin') {
                try {
                    await bridge.sendToUser({
                        type: 'permission_response',
                        data: {
                            username: username,
                            approved: approved
                        }
                    });
                    console.log(`${logStyles.bright}${logStyles.fg.blue}[BRIDGE]${logStyles.reset} Permission response forwarded to user server`);
                } catch (err) {
                    console.error(`${logStyles.fg.red}Error forwarding permission response: ${err}${logStyles.reset}`);
                }
            }
            
            // Broadcast to all clients so the user can connect
            broadcastMessage(JSON.stringify({
                type: 'permission_response',
                username: username,
                approved: approved
            }), null);
            
            // Update admin's pending requests list
            sendPendingRequestsToAdmin();
        } catch (e) {
            console.error(`${logStyles.fg.red}Error parsing permission response: ${e}${logStyles.reset}`);
        }
        return;
    }    // Handle typing indicator
    if (messageStr.startsWith("TYPING:") || messageStr.startsWith("STOPPED_TYPING:")) {
        // Forward typing status to all other clients
        broadcastMessage(messageStr, ws);
        
        // If this is cross-server, forward to the other server
        if (SERVER_TYPE === 'admin') {
            try {
                bridge.sendToUser({
                    type: 'chat_message',
                    data: {
                        type: 'typing',
                        message: messageStr
                    }
                }).catch(err => console.error(`${logStyles.fg.red}Error forwarding typing status: ${err}${logStyles.reset}`));
            } catch (err) {
                console.error(`${logStyles.fg.red}Error forwarding typing status: ${err}${logStyles.reset}`);
            }
        } else if (SERVER_TYPE === 'user') {
            try {
                bridge.sendToAdmin({
                    type: 'chat_message',
                    data: {
                        type: 'typing',
                        message: messageStr
                    }
                }).catch(err => console.error(`${logStyles.fg.red}Error forwarding typing status: ${err}${logStyles.reset}`));
            } catch (err) {
                console.error(`${logStyles.fg.red}Error forwarding typing status: ${err}${logStyles.reset}`);
            }
        }
        return;
    }
    
    // Try to parse as JSON for special messages
    try {
        const data = JSON.parse(messageStr);
        
        // Handle private messages
        if (data.type === 'private_message') {
            const sender = data.sender;
            const recipient = data.recipient;
            
            console.log(`${logStyles.bright}${logStyles.fg.magenta}[PRIVATE]${logStyles.reset} ${sender} → ${recipient}`);
            
            // Find the recipient client on this server
            let recipientFound = false;
            for (const client of activeClients) {
                if (clientUsernames.get(client) === recipient) {
                    // Forward the message to the recipient
                    client.send(messageStr);
                    recipientFound = true;
                    break;
                }
            }
            
            // If recipient not found on this server, try the other server
            if (!recipientFound) {
                if (SERVER_TYPE === 'admin') {
                    try {
                        bridge.sendToUser({
                            type: 'chat_message',
                            data: data
                        }).catch(err => console.error(`${logStyles.fg.red}Error forwarding private message: ${err}${logStyles.reset}`));
                    } catch (err) {
                        console.error(`${logStyles.fg.red}Error forwarding private message: ${err}${logStyles.reset}`);
                    }
                } else if (SERVER_TYPE === 'user') {
                    try {
                        bridge.sendToAdmin({
                            type: 'chat_message',
                            data: data
                        }).catch(err => console.error(`${logStyles.fg.red}Error forwarding private message: ${err}${logStyles.reset}`));
                    } catch (err) {
                        console.error(`${logStyles.fg.red}Error forwarding private message: ${err}${logStyles.reset}`);
                    }
                }
            }
            
            // Save to database if available
            if (dbAvailable && data.message) {
                saveMessageToDatabase(sender, data.message, 'text', true, recipient);
                console.log(`${logStyles.fg.cyan}[DB]${logStyles.reset} Private message saved to database`);
            }
            
            return;
        }
        
        // Handle public key requests and responses
        if (data.type === 'public_key_request' || data.type === 'public_key_response') {
            const target = data.target || data.recipient;
            
            // Find the target client on this server
            let targetFound = false;
            for (const client of activeClients) {
                if (clientUsernames.get(client) === target) {
                    // Forward the request/response to the target
                    client.send(messageStr);
                    targetFound = true;
                    break;
                }
            }
            
            // If target not found on this server, try the other server
            if (!targetFound) {
                if (SERVER_TYPE === 'admin') {
                    try {
                        bridge.sendToUser({
                            type: 'chat_message',
                            data: data
                        }).catch(err => console.error(`${logStyles.fg.red}Error forwarding key exchange: ${err}${logStyles.reset}`));
                    } catch (err) {
                        console.error(`${logStyles.fg.red}Error forwarding key exchange: ${err}${logStyles.reset}`);
                    }
                } else if (SERVER_TYPE === 'user') {
                    try {
                        bridge.sendToAdmin({
                            type: 'chat_message',
                            data: data
                        }).catch(err => console.error(`${logStyles.fg.red}Error forwarding key exchange: ${err}${logStyles.reset}`));
                    } catch (err) {
                        console.error(`${logStyles.fg.red}Error forwarding key exchange: ${err}${logStyles.reset}`);
                    }
                }
            }
            return;
        }
    } catch (e) {
        // Not JSON, continue with normal message handling
    }    // Handle regular messages
    if (messageStr.includes(': ')) {
        const [username, content] = messageStr.split(': ', 2);
        
        console.log(`${logStyles.bright}${logStyles.fg.green}[MESSAGE]${logStyles.reset} ${username}: ${content}`);
        
        // Save to database if available
        if (dbAvailable) {
            saveMessageToDatabase(username, content);
            console.log(`${logStyles.fg.cyan}[DB]${logStyles.reset} Message saved to database`);
        }
        
        // Broadcast to clients on this server
        broadcastMessage(messageStr, ws);
        
        // Forward to the other server
        if (SERVER_TYPE === 'admin') {
            try {
                bridge.sendToUser({
                    type: 'chat_message',
                    data: {
                        type: 'text',
                        message: messageStr
                    }
                }).catch(err => console.error(`${logStyles.fg.red}Error forwarding message: ${err}${logStyles.reset}`));
            } catch (err) {
                console.error(`${logStyles.fg.red}Error forwarding message: ${err}${logStyles.reset}`);
            }
        } else if (SERVER_TYPE === 'user') {
            try {
                bridge.sendToAdmin({
                    type: 'chat_message',
                    data: {
                        type: 'text',
                        message: messageStr
                    }
                }).catch(err => console.error(`${logStyles.fg.red}Error forwarding message: ${err}${logStyles.reset}`));
            } catch (err) {
                console.error(`${logStyles.fg.red}Error forwarding message: ${err}${logStyles.reset}`);
            }
        }
        
        return;
    }
    
    // If we got here, it's an unknown message type
    console.log(`${logStyles.fg.yellow}Unknown message format: ${messageStr}${logStyles.reset}`);
}

// Send pending requests to admin
function sendPendingRequestsToAdmin() {
    if (adminClient && adminClient.readyState === WebSocket.OPEN) {
        adminClient.send(JSON.stringify({
            type: 'pending_requests',
            requests: pendingRequests
        }));
    }
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log(`${logStyles.bright}${logStyles.fg.blue}[CONNECTION]${logStyles.reset} New client connected`);
    
    // Handle messages
    ws.on('message', (message) => {
        const messageStr = message.toString();
        
        // Add message to queue for serial processing
        messageQueue.push({
            message: messageStr,
            sender: ws,
            callback: null
        });
        
        // Start processing if not already
        processMessageQueue();
    });
    
    // Handle disconnection
    ws.on('close', () => {
        const username = clientUsernames.get(ws) || 'Unknown';
        console.log(`${logStyles.bright}${logStyles.fg.yellow}[DISCONNECT]${logStyles.reset} Client ${username} disconnected`);
        
        // Check if this was the admin
        if (ws === adminClient) {
            adminClient = null;
            adminConnected = false;
            console.log(`${logStyles.bright}${logStyles.fg.yellow}[ADMIN]${logStyles.reset} Admin disconnected`);
        }
        
        // Remove from active clients
        const index = activeClients.indexOf(ws);
        if (index !== -1) {
            activeClients.splice(index, 1);
        }
        
        // Remove from usernames
        clientUsernames.delete(ws);
        
        // Notify all clients
        broadcastMessage(`${username} has left the chat!`, null);
        
        // Update user list
        broadcastUserList();
    });
});// Broadcast message to all clients except the sender
function broadcastMessage(message, sender) {
    for (const client of activeClients) {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

// Broadcast user list to all clients
function broadcastUserList() {
    // Combine users from both servers if in multi-server mode
    let users = Array.from(clientUsernames.values());
    
    // In multi-server mode, try to get users from the other server
    if (SERVER_TYPE === 'admin' || SERVER_TYPE === 'user') {
        const otherServerType = SERVER_TYPE === 'admin' ? 'user' : 'admin';
        const otherServerPort = SERVER_TYPE === 'admin' ? config.USER_PORT : config.ADMIN_PORT;
        
        // We'll send the current user list to clients anyway
        sendUserListToClients(users);
        
        // Try to get users from the other server asynchronously
        if (SERVER_TYPE === 'admin') {
            bridge.sendToUser({
                type: 'get_users'
            }).then(response => {
                if (response.users) {
                    // Combine with local users, removing duplicates
                    const combinedUsers = [...new Set([...users, ...response.users])];
                    sendUserListToClients(combinedUsers);
                }
            }).catch(err => {
                console.error(`${logStyles.fg.red}Error getting users from user server: ${err}${logStyles.reset}`);
            });
        } else {
            bridge.sendToAdmin({
                type: 'get_users'
            }).then(response => {
                if (response.users) {
                    // Combine with local users, removing duplicates
                    const combinedUsers = [...new Set([...users, ...response.users])];
                    sendUserListToClients(combinedUsers);
                }
            }).catch(err => {
                console.error(`${logStyles.fg.red}Error getting users from admin server: ${err}${logStyles.reset}`);
            });
        }
    } else {
        // In standalone mode, just send the current users
        sendUserListToClients(users);
    }
}

// Send user list to all clients
function sendUserListToClients(users) {
    const userListData = {
        type: 'user_list',
        users: users
    };
    
    const message = JSON.stringify(userListData);
    for (const client of activeClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
    
    console.log(`${logStyles.fg.blue}[USERS]${logStyles.reset} Active users: ${users.join(', ') || 'None'}`);
}

// Print server banner
function printServerBanner() {
    console.log('\n');
    console.log(`${logStyles.bright}${logStyles.fg.cyan}╔════════════════════════════════════════════════════════════╗${logStyles.reset}`);
    console.log(`${logStyles.bright}${logStyles.fg.cyan}║                                                            ║${logStyles.reset}`);
    
    if (SERVER_TYPE === 'admin') {
        console.log(`${logStyles.bright}${logStyles.fg.cyan}║                GALAXY CHAT ADMIN SERVER                    ║${logStyles.reset}`);
    } else if (SERVER_TYPE === 'user') {
        console.log(`${logStyles.bright}${logStyles.fg.cyan}║                GALAXY CHAT USER SERVER                     ║${logStyles.reset}`);
    } else {
        console.log(`${logStyles.bright}${logStyles.fg.cyan}║                GALAXY CHAT SERVER                          ║${logStyles.reset}`);
    }
    
    console.log(`${logStyles.bright}${logStyles.fg.cyan}║                                                            ║${logStyles.reset}`);
    console.log(`${logStyles.bright}${logStyles.fg.cyan}╚════════════════════════════════════════════════════════════╝${logStyles.reset}`);
    console.log('\n');
}

// Start the server
async function startServer() {
    printServerBanner();
    
    // Check database connection first
    await checkDatabaseConnection();
    
    // Add admin to approved users
    if (!approvedUsers.includes(ADMIN_USERNAME)) {
        approvedUsers.push(ADMIN_USERNAME);
    }
    
    server.listen(PORT, () => {
        console.log('\n');
        console.log(`${logStyles.bright}${logStyles.fg.green}[SERVER]${logStyles.reset} Server running on ${logStyles.underscore}http://localhost:${PORT}${logStyles.reset}`);
        console.log(`${logStyles.bright}${logStyles.fg.green}[SERVER]${logStyles.reset} WebSocket server running on ${logStyles.underscore}ws://localhost:${PORT}${logStyles.reset}`);
        console.log(`${logStyles.bright}${logStyles.fg.green}[SERVER]${logStyles.reset} Server type: ${SERVER_TYPE}`);
        console.log(`${logStyles.bright}${logStyles.fg.green}[SERVER]${logStyles.reset} Database mode: ${dbAvailable ? logStyles.fg.green + 'Connected' : logStyles.fg.yellow + 'Disabled'}${logStyles.reset}`);
        console.log('\n');
        console.log(`${logStyles.bright}${logStyles.fg.cyan}[INFO]${logStyles.reset} Press Ctrl+C to stop the server`);
        console.log('\n');
    });
}

startServer();