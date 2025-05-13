// Handle a message
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
    }