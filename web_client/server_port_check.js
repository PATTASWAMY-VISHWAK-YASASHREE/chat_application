const http = require('http');
const net = require('net');

// Function to check if a port is in use
function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${port} is already in use`);
                resolve(false);
            } else {
                console.log(`Error checking port ${port}: ${err.message}`);
                resolve(false);
            }
        });
        
        server.once('listening', () => {
            server.close();
            console.log(`Port ${port} is available`);
            resolve(true);
        });
        
        server.listen(port);
    });
}

// Check common ports
async function checkPorts() {
    console.log('Checking if ports are available...');
    
    await checkPort(8080);
    await checkPort(3000);
    await checkPort(5000);
    await checkPort(8000);
    
    console.log('Port check complete');
}

// Run the port check
checkPorts();