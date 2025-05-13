    // Handle permission check
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
    }