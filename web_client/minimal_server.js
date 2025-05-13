const http = require('http');
const fs = require('fs');
const path = require('path');

// Create a very simple HTTP server
const server = http.createServer((req, res) => {
    console.log(`Request received: ${req.url}`);
    
    // Serve a simple HTML response
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Minimal Test</title>
        </head>
        <body style="background-color: #333; color: white; font-family: Arial; text-align: center; padding-top: 100px;">
            <h1>Minimal Server Test</h1>
            <p>If you can see this page, the server is working!</p>
            <p>Current time: ${new Date().toLocaleTimeString()}</p>
        </body>
        </html>
    `);
});

// Start the server on port 8080
const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Minimal server running on http://localhost:${PORT}`);
});