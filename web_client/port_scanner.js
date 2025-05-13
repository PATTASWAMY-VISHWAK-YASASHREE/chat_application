// port_scanner.js - Utility to find available ports
const net = require('net');

/**
 * Check if a port is available
 * @param {number} port - The port to check
 * @returns {Promise<boolean>} - True if port is available, false otherwise
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false); // Port is in use
      } else {
        resolve(false); // Other error, consider port unavailable
      }
    });
    
    server.once('listening', () => {
      // Close the server and resolve with true (port is available)
      server.close(() => {
        resolve(true);
      });
    });
    
    server.listen(port);
  });
}

/**
 * Find an available port starting from the preferred port
 * @param {number} preferredPort - The port to start checking from
 * @param {number} maxAttempts - Maximum number of ports to check
 * @returns {Promise<number>} - The first available port found
 */
async function findAvailablePort(preferredPort, maxAttempts = 10) {
  console.log(`Scanning for available ports starting from ${preferredPort}...`);
  
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferredPort + i;
    const available = await isPortAvailable(port);
    
    if (available) {
      console.log(`Found available port: ${port}`);
      return port;
    }
    console.log(`Port ${port} is in use, trying next...`);
  }
  
  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
}

module.exports = {
  isPortAvailable,
  findAvailablePort
};