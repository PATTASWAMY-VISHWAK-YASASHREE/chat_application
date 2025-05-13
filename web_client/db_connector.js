// db_connector.js - PostgreSQL database connector
const { Pool } = require('pg');
const config = require('./server_config');

// Create a connection pool
const pool = new Pool(config.DB_CONFIG);

/**
 * Check if the database connection is working
 * @returns {Promise<boolean>} - True if connected, false otherwise
 */
async function checkConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection successful');
    return true;
  } catch (err) {
    console.error('Database connection error:', err.message);
    return false;
  }
}

/**
 * Initialize the database tables if they don't exist
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function initDatabase() {
  try {
    const client = await pool.connect();
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        is_approved BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES chat_users(id),
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        message_type VARCHAR(20) DEFAULT 'text',
        is_private BOOLEAN DEFAULT FALSE,
        recipient_id INTEGER REFERENCES chat_users(id)
      )
    `);
    
    // Create permission requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS permission_requests (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP
      )
    `);
    
    // Insert admin user if not exists
    await client.query(`
      INSERT INTO chat_users (username, is_approved, is_admin)
      VALUES ($1, TRUE, TRUE)
      ON CONFLICT (username) DO NOTHING
    `, [config.ADMIN_USERNAME]);
    
    client.release();
    console.log('Database initialized successfully');
    return true;
  } catch (err) {
    console.error('Database initialization error:', err.message);
    return false;
  }
}

/**
 * Check if a user is approved
 * @param {string} username - The username to check
 * @returns {Promise<boolean>} - True if approved, false otherwise
 */
async function isUserApproved(username) {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT is_approved FROM chat_users WHERE username = $1',
      [username]
    );
    client.release();
    
    if (result.rows.length === 0) {
      // User doesn't exist yet
      return false;
    }
    
    return result.rows[0].is_approved;
  } catch (err) {
    console.error('Error checking user approval:', err.message);
    return false;
  }
}

/**
 * Create a permission request
 * @param {string} username - The username requesting permission
 * @param {string} reason - The reason for the request
 * @returns {Promise<boolean>} - True if request created, false otherwise
 */
async function createPermissionRequest(username, reason) {
  try {
    const client = await pool.connect();
    
    // Create user if not exists
    await client.query(
      'INSERT INTO chat_users (username, is_approved) VALUES ($1, FALSE) ON CONFLICT (username) DO NOTHING',
      [username]
    );
    
    // Create permission request
    await client.query(
      'INSERT INTO permission_requests (username, reason) VALUES ($1, $2)',
      [username, reason]
    );
    
    client.release();
    return true;
  } catch (err) {
    console.error('Error creating permission request:', err.message);
    return false;
  }
}

/**
 * Approve or deny a user
 * @param {string} username - The username to approve/deny
 * @param {boolean} approved - True to approve, false to deny
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function setUserApproval(username, approved) {
  try {
    const client = await pool.connect();
    
    // Update user approval status
    await client.query(
      'UPDATE chat_users SET is_approved = $1 WHERE username = $2',
      [approved, username]
    );
    
    // Update permission request status
    await client.query(
      'UPDATE permission_requests SET status = $1, processed_at = NOW() WHERE username = $2 AND status = \'pending\'',
      [approved ? 'approved' : 'denied', username]
    );
    
    client.release();
    return true;
  } catch (err) {
    console.error('Error setting user approval:', err.message);
    return false;
  }
}

/**
 * Get pending permission requests
 * @returns {Promise<Array>} - Array of pending requests
 */
async function getPendingRequests() {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT username, reason, requested_at FROM permission_requests WHERE status = \'pending\' ORDER BY requested_at'
    );
    client.release();
    return result.rows;
  } catch (err) {
    console.error('Error getting pending requests:', err.message);
    return [];
  }
}

/**
 * Save a chat message to the database
 * @param {string} username - The sender's username
 * @param {string} message - The message content
 * @param {boolean} isPrivate - Whether this is a private message
 * @param {string} recipient - The recipient's username (for private messages)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function saveMessage(username, message, isPrivate = false, recipient = null) {
  try {
    const client = await pool.connect();
    
    // Get sender ID
    const senderResult = await client.query(
      'SELECT id FROM chat_users WHERE username = $1',
      [username]
    );
    
    if (senderResult.rows.length === 0) {
      // Create user if not exists
      const newUserResult = await client.query(
        'INSERT INTO chat_users (username, is_approved) VALUES ($1, FALSE) RETURNING id',
        [username]
      );
      var senderId = newUserResult.rows[0].id;
    } else {
      var senderId = senderResult.rows[0].id;
    }
    
    // Get recipient ID for private messages
    let recipientId = null;
    if (isPrivate && recipient) {
      const recipientResult = await client.query(
        'SELECT id FROM chat_users WHERE username = $1',
        [recipient]
      );
      
      if (recipientResult.rows.length > 0) {
        recipientId = recipientResult.rows[0].id;
      }
    }
    
    // Save message
    await client.query(
      'INSERT INTO chat_messages (sender_id, message, is_private, recipient_id) VALUES ($1, $2, $3, $4)',
      [senderId, message, isPrivate, recipientId]
    );
    
    client.release();
    return true;
  } catch (err) {
    console.error('Error saving message:', err.message);
    return false;
  }
}

module.exports = {
  checkConnection,
  initDatabase,
  isUserApproved,
  createPermissionRequest,
  setUserApproval,
  getPendingRequests,
  saveMessage
};