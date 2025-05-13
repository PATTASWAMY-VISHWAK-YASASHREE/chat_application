// Create HTTP server
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
const wss = new WebSocket.Server({ server });

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
}