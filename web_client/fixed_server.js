// fixed_server.js - Fixed version with admin permissions and database integration
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const portScanner = require('./port_scanner');
const db = require('./db_connector');
const bridge = require('./server_bridge');
const config = require('./server_config');

// Server type configuration
const SERVER_TYPE = process.argv[2] === 'admin' ? 'admin' : 'user';
// Default ports (will be overridden if not available)
const DEFAULT_ADMIN_PORT = config.ADMIN_PORT;
const DEFAULT_USER_PORT = config.USER_PORT;

// Global variables
const activeClients = [];
const clientUsernames = new Map();
const ADMIN_USERNAME = config.ADMIN_USERNAME;
const approvedUsers = [ADMIN_USERNAME]; // Start with admin pre-approved
const pendingRequests = []; // Store pending permission requests
let adminClient = null; // Reference to admin client
let dbAvailable = false; // Flag for database availability

// Create HTTP server
const server = http.createServer((req, res) => {
    console.log(`Request received: ${req.url}`);
    
    // Serve index.html for root path
    let filePath;
    if (req.url === '/' || req.url === '/index.html') {
        filePath = path.join(__dirname, 'index.html');
    } else {
        filePath = path.join(__dirname, req.url);
    }
    
    // Read and serve the file
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('404 Not Found');
            return;
        }
        
        // Determine content type
        let contentType = 'text/html';
        const ext = path.extname(filePath);
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.js') contentType = 'text/javascript';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
    });
});

// Create WebSocket server - IMPORTANT: Define wss before using it
const wss = new WebSocket.Server({ server });

// Broadcast message to all clients except the sender
function broadcastMessage(message, sender) {
    for (const client of activeClients) {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

// Broadcast user list to all clients
function broadcastUserList() {
    const users = Array.from(clientUsernames.values());
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
    
    console.log(`Active users: ${users.join(', ') || 'None'}`);
}

// Handle HTTP requests for server-to-server communication
server.on('request', (req, res) => {
    // Handle bridge requests for cross-server communication
    if (req.url === '/bridge' && req.method === 'POST') {
        bridge.handleBridgeRequest(req, res, SERVER_TYPE, handleBridgeMessage);
    }
});

// Handle bridge messages from other servers
async function handleBridgeMessage(message) {
    console.log(`Received cross-server message: ${message.type}`);
    
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
    }
    
    return { success: false, message: 'Message not handled by this server type' };
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log(`New client connected to ${SERVER_TYPE} server`);
    
    // Handle messages
    ws.on('message', (message) => {
        const messageStr = message.toString();
        console.log(`Received: ${messageStr}`);
        
        // Handle username registration
        if (messageStr.startsWith("USERNAME:")) {
            const username = messageStr.substring(9);
            
            // Check if this is the admin
            if (username === ADMIN_USERNAME) {
                // Only allow admin on admin server
                if (SERVER_TYPE !== 'admin') {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Admin login is only allowed on the admin server'
                    }));
                    ws.close();
                    return;
                }
                
                adminClient = ws;
                console.log(`Admin connected to ${SERVER_TYPE} server`);
            }
            
            // Check if user is approved or needs permission
            if (username === ADMIN_USERNAME || approvedUsers.includes(username)) {
                // User is approved
                clientUsernames.set(ws, username);
                activeClients.push(ws);
                
                // Send welcome message
                ws.send(`Welcome to the chat, ${username}!`);
                
                // Send database status
                ws.send(`Database status: ${dbAvailable ? 'Connected' : 'Not connected'}`);
                
                // Send user settings
            ws.send(JSON.stringify({
                type: 'settings',
                theme: 'space',
                username: username,
                serverType: SERVER_TYPE,
                isAdmin: username === ADMIN_USERNAME
            }));
            
            // Broadcast user list
            broadcastUserList();
            
            // Broadcast join message
            broadcastMessage(`${username} has joined the chat!`, ws);
            
            // If this is the admin, send pending requests
            if (username === ADMIN_USERNAME) {
                sendPendingRequestsToAdmin(ws);
            }
            
            // Save to database if available
            if (dbAvailable) {
                db.saveMessage('System', `${username} has joined the chat!`);
            }
        } 
        // Handle permission request
        else if (messageStr.startsWith('{\"type\":\"permission_request\"')) {
            try {
                const data = JSON.parse(messageStr);
                const username = data.username;
                const reason = data.reason || 'No reason provided';
                
                console.log(`Permission request from ${username}: ${reason}`);
                
                // Save request to database if available
                if (dbAvailable) {
                    db.createPermissionRequest(username, reason);
                }
                
                // If this is the admin server, add to pending requests
                if (SERVER_TYPE === 'admin') {
                    pendingRequests.push({ username, reason });
                    
                    // Send to admin if connected
                    if (adminClient && adminClient.readyState === WebSocket.OPEN) {
                        adminClient.send(JSON.stringify({
                            type: 'permission_request',
                            username,
                            reason
                        }));
                    }
                } 
                // If this is the user server, forward to admin server
                else {
                    bridge.sendToAdmin({
                        type: 'permission_request',
                        data: { username, reason }
                    }).catch(err => console.error(`Error forwarding permission request: ${err}`));
                }
                
                // Send acknowledgment to the client
                ws.send(JSON.stringify({
                    type: 'permission_request_received',
                    message: 'Your request has been sent to the admin'
                }));
            } catch (e) {
                console.error(`Error parsing permission request: ${e}`);
            }
        }
        // Handle permission response (from admin)
        else if (messageStr.startsWith('{\"type\":\"permission_response\"')) {
            try {
                const data = JSON.parse(messageStr);
                const username = data.username;
                const approved = data.approved;
                
                console.log(`Permission ${approved ? 'approved' : 'denied'} for ${username}`);
                
                // Update database if available
                if (dbAvailable) {
                    db.setUserApproval(username, approved);
                }
                
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
                    bridge.sendToUser({
                        type: 'permission_response',
                        data: {
                            username: username,
                            approved: approved
                        }
                    }).catch(err => console.error(`Error forwarding permission response: ${err}`));
                }
                
                // Broadcast to all clients
                broadcastMessage(JSON.stringify({
                    type: 'permission_response',
                    username: username,
                    approved: approved
                }), null);
            } catch (e) {
                console.error(`Error parsing permission response: ${e}`);
            }
        }
        // Handle regular messages
        else if (messageStr.includes(': ')) {
            broadcastMessage(messageStr, ws);
            
            // Save to database if available
            if (dbAvailable) {
                const [username, content] = messageStr.split(': ', 2);
                db.saveMessage(username, content);
            }
            
            // Forward to the other server
            if (SERVER_TYPE === 'admin') {
                bridge.sendToUser({
                    type: 'chat_message',
                    data: {
                        type: 'text',
                        message: messageStr
                    }
                }).catch(err => console.error(`Error forwarding message: ${err}`));
            } else if (SERVER_TYPE === 'user') {
                bridge.sendToAdmin({
                    type: 'chat_message',
                    data: {
                        type: 'text',
                        message: messageStr
                    }
                }).catch(err => console.error(`Error forwarding message: ${err}`));
            }
        }
    });
    
    // Handle disconnection
    ws.on('close', () => {
        const username = clientUsernames.get(ws) || 'Unknown';
        console.log(`Client ${username} disconnected`);
        
        // Remove from active clients
        const index = activeClients.indexOf(ws);
        if (index !== -1) {
            activeClients.splice(index, 1);
        }
        
        // Remove from usernames
        clientUsernames.delete(ws);
        
        // Broadcast user list
        broadcastUserList();
        
        // Broadcast leave message
        broadcastMessage(`${username} has left the chat!`, null);
    });
});

// Send pending requests to admin
function sendPendingRequestsToAdmin(adminWs) {
    if (adminWs && adminWs.readyState === WebSocket.OPEN) {
        adminWs.send(JSON.stringify({
            type: 'pending_requests',
            requests: pendingRequests
        }));
    }
}

// Start the server with port scanning and database connection
async function startServer() {
    try {
        console.log(`Starting ${SERVER_TYPE} server...`);
        
        // Check database connection
        console.log('Connecting to database...');
        dbAvailable = await db.checkConnection();
        
        if (dbAvailable) {
            console.log('Initializing database...');
            await db.initDatabase();
            
            // Load approved users from database
            if (SERVER_TYPE === 'user') {
                console.log('Loading approved users from database...');
                // This would be implemented in a real system
            }
        } else {
            console.log('Running without database connection');
        }
        
        // Determine which default port to use based on server type
        const defaultPort = SERVER_TYPE === 'admin' ? DEFAULT_ADMIN_PORT : DEFAULT_USER_PORT;
        
        // Find an available port
        const PORT = await portScanner.findAvailablePort(defaultPort);
        
        // Update the config with the actual port being used
        if (SERVER_TYPE === 'admin') {
            config.ADMIN_PORT = PORT;
        } else {
            config.USER_PORT = PORT;
        }
        
        // Start the server on the available port
        server.listen(PORT, () => {
            console.log(`${SERVER_TYPE} server running on http://localhost:${PORT}`);
            console.log(`WebSocket server running on ws://localhost:${PORT}`);
            console.log(`Database connection: ${dbAvailable ? 'Connected' : 'Not connected'}`);
        });
    } catch (error) {
        console.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
}

// Initialize the server
startServer();