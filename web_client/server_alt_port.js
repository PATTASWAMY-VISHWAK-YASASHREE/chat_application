const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Server type and port configuration
const SERVER_TYPE = process.argv[2] === 'admin' ? 'admin' : 'user';

// Try different ports for the user server
const PORT = SERVER_TYPE === 'admin' ? 5059 : 3000;

console.log(`Starting ${SERVER_TYPE} server on port ${PORT}`);

// Create HTTP server
const server = http.createServer((req, res) => {
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
const wss = new WebSocket.Server({ server });

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
server.listen(PORT, () => {
    console.log(`${SERVER_TYPE} server running on http://localhost:${PORT}`);
    console.log(`Open your browser to http://localhost:${PORT} to view the chat application`);
});