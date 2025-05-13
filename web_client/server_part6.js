    // Handle typing indicator
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
    }