/**
 * Server Configuration
 * This file contains configuration for both admin and user servers
 */

module.exports = {
    // Server ports
    ADMIN_PORT: 5059,
    USER_PORT: 5000,
    
    // Admin credentials
    ADMIN_USERNAME: 'Admin',
    ADMIN_PASSWORD: 'admin123',
    
    // Server-to-server communication
    SERVER_SECRET: 'galaxy-chat-secret-key', // For server-to-server authentication
    
    // Database configuration
    DB_CONFIG: {
        user: 'postgres',
        host: 'localhost',
        database: 'chat_application',
        password: 'vishwak',
        port: 5432,
    }
};