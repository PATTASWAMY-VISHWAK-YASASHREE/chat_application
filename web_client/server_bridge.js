// server_bridge.js - Communication bridge between admin and user servers
const http = require('http');
const config = require('./server_config');

/**
 * Send a message to the admin server
 * @param {Object} message - The message to send
 * @returns {Promise<Object>} - The response from the admin server
 */
function sendToAdmin(message) {
  return sendMessage(message, config.ADMIN_PORT);
}

/**
 * Send a message to the user server
 * @param {Object} message - The message to send
 * @returns {Promise<Object>} - The response from the user server
 */
function sendToUser(message) {
  return sendMessage(message, config.USER_PORT);
}

/**
 * Send a message to a server
 * @param {Object} message - The message to send
 * @param {number} port - The port of the target server
 * @returns {Promise<Object>} - The response from the server
 */
function sendMessage(message, port) {
  return new Promise((resolve, reject) => {
    // Add authentication
    const data = JSON.stringify({
      ...message,
      auth: {
        secret: config.SERVER_SECRET
      }
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
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (e) {
          reject(new Error(`Invalid response: ${responseData}`));
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

/**
 * Handle bridge requests from other servers
 * @param {http.IncomingMessage} req - The request object
 * @param {http.ServerResponse} res - The response object
 * @param {string} serverType - The type of this server (admin or user)
 * @param {Function} messageHandler - Function to handle the message
 */
function handleBridgeRequest(req, res, serverType, messageHandler) {
  let data = '';
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', async () => {
    try {
      const message = JSON.parse(data);
      
      // Verify authentication
      if (!message.auth || message.auth.secret !== config.SERVER_SECRET) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Authentication failed' }));
        return;
      }
      
      // Process the message
      const result = await messageHandler(message);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: error.message }));
    }
  });
}

module.exports = {
  sendToAdmin,
  sendToUser,
  handleBridgeRequest
};