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