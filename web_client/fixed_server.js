// fixed_server.js - Fixed version with correct variable order
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Server type and port configuration
const SERVER_TYPE = process.argv[2] === 'admin' ? 'admin' : 'user';
const PORT = SERVER_TYPE === 'admin' ? 5059 : 8080;

console.log(`Starting ${SERVER_TYPE} server on port ${PORT}`);

// Global variables
const activeClients = [];
const clientUsernames = new Map();
const ADMIN_USERNAME = 'Admin';

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
            clientUsernames.set(ws, username);
            activeClients.push(ws);
            
            // Send welcome message
            ws.send(`Welcome to the chat, ${username}!`);
            
            // Send user settings
            ws.send(JSON.stringify({
                type: 'settings',
                theme: 'space',
                username: username,
                serverType: SERVER_TYPE
            }));
            
            // Broadcast user list
            broadcastUserList();
            
            // Broadcast join message
            broadcastMessage(`${username} has joined the chat!`, ws);
        }
        // Handle regular messages
        else if (messageStr.includes(': ')) {
            broadcastMessage(messageStr, ws);
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

// Start the server
server.listen(PORT, () => {
    console.log(`${SERVER_TYPE} server running on http://localhost:${PORT}`);
});