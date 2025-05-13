    // Handle regular messages
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
});