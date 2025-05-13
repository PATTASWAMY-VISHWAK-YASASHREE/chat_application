/**
 * Server Bridge
 * Handles communication between admin and user servers
 */

const http = require('http');
const config = require('./server_config');

// Create a bridge between servers
class ServerBridge {
    constructor() {
        this.adminPort = config.ADMIN_PORT;
        this.userPort = config.USER_PORT;
        this.serverSecret = config.SERVER_SECRET;
    }

    // Send message from user server to admin server
    async sendToAdmin(message) {
        return this.sendMessage(this.adminPort, message);
    }

    // Send message from admin server to user server
    async sendToUser(message) {
        return this.sendMessage(this.userPort, message);
    }

    // Generic method to send message to another server
    async sendMessage(port, message) {
        return new Promise((resolve, reject) => {
            // Add server secret for authentication
            const data = JSON.stringify({
                ...message,
                serverSecret: this.serverSecret
            });

            const options = {
                hostname: 'localhost',
                port: port,
                path: '/bridge',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = http.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const parsedData = JSON.parse(responseData);
                            resolve(parsedData);
                        } catch (e) {
                            resolve({ success: true, message: responseData });
                        }
                    } else {
                        reject(new Error(`Server responded with status code ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    // Handle incoming bridge requests
    handleBridgeRequest(req, res, serverType, messageHandler) {
        let body = '';
        
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const message = JSON.parse(body);
                
                // Verify server secret
                if (message.serverSecret !== this.serverSecret) {
                    res.writeHead(403);
                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                    return;
                }
                
                // Process the message
                const result = await messageHandler(message);
                
                // Send response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result || { success: true }));
                
            } catch (error) {
                console.error(`Error handling bridge request: ${error}`);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        });
    }
}

module.exports = new ServerBridge();