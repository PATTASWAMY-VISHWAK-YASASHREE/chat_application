/**
 * Database Check Script
 * This script checks if the database is properly set up and data is being written
 */

const { Pool } = require('pg');

// Database configuration
const DB_CONFIG = {
    user: 'postgres',
    host: 'localhost',
    database: 'chat_application',
    password: 'vishwak',
    port: 5432,
};

// Console log styling
const logStyles = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    
    fg: {
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m'
    },
    
    bg: {
        black: '\x1b[40m',
        red: '\x1b[41m',
        green: '\x1b[42m',
        yellow: '\x1b[43m',
        blue: '\x1b[44m',
        magenta: '\x1b[45m',
        cyan: '\x1b[46m',
        white: '\x1b[47m'
    }
};

// Print banner
function printBanner() {
    console.log('\n');
    console.log(`${logStyles.bright}${logStyles.fg.cyan}╔════════════════════════════════════════════════════════════╗${logStyles.reset}`);
    console.log(`${logStyles.bright}${logStyles.fg.cyan}║                                                            ║${logStyles.reset}`);
    console.log(`${logStyles.bright}${logStyles.fg.cyan}║                DATABASE CHECK UTILITY                      ║${logStyles.reset}`);
    console.log(`${logStyles.bright}${logStyles.fg.cyan}║                                                            ║${logStyles.reset}`);
    console.log(`${logStyles.bright}${logStyles.fg.cyan}╚════════════════════════════════════════════════════════════╝${logStyles.reset}`);
    console.log('\n');
}

// Check database connection
async function checkConnection() {
    const pool = new Pool(DB_CONFIG);
    
    try {
        console.log(`${logStyles.fg.cyan}Connecting to database...${logStyles.reset}`);
        
        const client = await pool.connect();
        
        console.log(`${logStyles.fg.green}Connection successful!${logStyles.reset}`);
        
        // Get PostgreSQL version
        const versionResult = await client.query('SELECT version()');
        console.log(`${logStyles.fg.green}PostgreSQL version: ${versionResult.rows[0].version}${logStyles.reset}`);
        
        client.release();
        return true;
    } catch (err) {
        console.error(`${logStyles.fg.red}Connection failed: ${err.message}${logStyles.reset}`);
        return false;
    } finally {
        await pool.end();
    }
}

// Check database tables
async function checkTables() {
    const pool = new Pool(DB_CONFIG);
    
    try {
        console.log(`${logStyles.fg.cyan}Checking database tables...${logStyles.reset}`);
        
        const client = await pool.connect();
        
        // Get list of tables
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        if (tablesResult.rowCount === 0) {
            console.log(`${logStyles.fg.red}No tables found in the database${logStyles.reset}`);
            client.release();
            return false;
        }
        
        console.log(`${logStyles.fg.green}Found ${tablesResult.rowCount} tables:${logStyles.reset}`);
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
        // Check required tables
        const requiredTables = ['chat_users', 'chat_messages', 'chat_rooms', 'room_members', 'room_messages'];
        const missingTables = requiredTables.filter(table => 
            !tablesResult.rows.some(row => row.table_name === table)
        );
        
        if (missingTables.length > 0) {
            console.log(`${logStyles.fg.red}Missing required tables: ${missingTables.join(', ')}${logStyles.reset}`);
            client.release();
            return false;
        }
        
        client.release();
        return true;
    } catch (err) {
        console.error(`${logStyles.fg.red}Error checking tables: ${err.message}${logStyles.reset}`);
        return false;
    } finally {
        await pool.end();
    }
}

// Check data in tables
async function checkData() {
    const pool = new Pool(DB_CONFIG);
    
    try {
        console.log(`${logStyles.fg.cyan}Checking data in tables...${logStyles.reset}`);
        
        const client = await pool.connect();
        
        // Check users
        const usersResult = await client.query('SELECT COUNT(*) FROM chat_users');
        const usersCount = parseInt(usersResult.rows[0].count);
        
        console.log(`${logStyles.fg.cyan}Users in database: ${usersCount}${logStyles.reset}`);
        
        if (usersCount > 0) {
            // Show some users
            const sampleUsers = await client.query('SELECT id, username, theme FROM chat_users LIMIT 5');
            console.log(`${logStyles.fg.green}Sample users:${logStyles.reset}`);
            sampleUsers.rows.forEach(user => {
                console.log(`  - ID: ${user.id}, Username: ${user.username}, Theme: ${user.theme}`);
            });
        }
        
        // Check messages
        const messagesResult = await client.query('SELECT COUNT(*) FROM chat_messages');
        const messagesCount = parseInt(messagesResult.rows[0].count);
        
        console.log(`${logStyles.fg.cyan}Messages in database: ${messagesCount}${logStyles.reset}`);
        
        if (messagesCount > 0) {
            // Show some messages
            const sampleMessages = await client.query(`
                SELECT m.id, u.username as sender, m.message, m.timestamp, m.is_private 
                FROM chat_messages m
                JOIN chat_users u ON m.sender_id = u.id
                ORDER BY m.timestamp DESC
                LIMIT 5
            `);
            
            console.log(`${logStyles.fg.green}Recent messages:${logStyles.reset}`);
            sampleMessages.rows.forEach(msg => {
                console.log(`  - ${msg.timestamp.toISOString().replace('T', ' ').substring(0, 19)} | ${msg.sender}: ${msg.message.substring(0, 50)}${msg.message.length > 50 ? '...' : ''} ${msg.is_private ? '(Private)' : ''}`);
            });
        }
        
        // Test inserting a message
        console.log(`${logStyles.fg.cyan}Testing message insertion...${logStyles.reset}`);
        
        // First get or create a test user
        let testUserId;
        const testUsername = 'TestUser';
        
        const userResult = await client.query('SELECT id FROM chat_users WHERE username = $1', [testUsername]);
        
        if (userResult.rowCount > 0) {
            testUserId = userResult.rows[0].id;
        } else {
            const newUserResult = await client.query(
                'INSERT INTO chat_users (username, last_seen) VALUES ($1, NOW()) RETURNING id',
                [testUsername]
            );
            testUserId = newUserResult.rows[0].id;
        }
        
        // Insert a test message
        const testMessage = 'This is a test message from the database check utility';
        await client.query(
            'INSERT INTO chat_messages (sender_id, message, timestamp, message_type) VALUES ($1, $2, NOW(), $3)',
            [testUserId, testMessage, 'text']
        );
        
        console.log(`${logStyles.fg.green}Test message inserted successfully${logStyles.reset}`);
        
        // Verify the message was inserted
        const verifyResult = await client.query(
            'SELECT id FROM chat_messages WHERE sender_id = $1 AND message = $2',
            [testUserId, testMessage]
        );
        
        if (verifyResult.rowCount > 0) {
            console.log(`${logStyles.fg.green}Message verified in database with ID: ${verifyResult.rows[0].id}${logStyles.reset}`);
        } else {
            console.log(`${logStyles.fg.red}Failed to verify message in database${logStyles.reset}`);
        }
        
        client.release();
        return true;
    } catch (err) {
        console.error(`${logStyles.fg.red}Error checking data: ${err.message}${logStyles.reset}`);
        return false;
    } finally {
        await pool.end();
    }
}

// Main function
async function main() {
    printBanner();
    
    // Check connection
    const connected = await checkConnection();
    if (!connected) {
        console.log(`${logStyles.fg.red}Database connection failed. Please check your PostgreSQL installation and configuration.${logStyles.reset}`);
        return;
    }
    
    // Check tables
    const tablesOk = await checkTables();
    if (!tablesOk) {
        console.log(`${logStyles.fg.yellow}Database tables are not properly set up.${logStyles.reset}`);
        console.log(`${logStyles.fg.yellow}Please run the setup_database.js script to create the required tables.${logStyles.reset}`);
        return;
    }
    
    // Check data
    const dataOk = await checkData();
    if (!dataOk) {
        console.log(`${logStyles.fg.yellow}There may be issues with data in the database.${logStyles.reset}`);
    } else {
        console.log(`\n${logStyles.bright}${logStyles.fg.green}Database check completed successfully!${logStyles.reset}`);
        console.log(`${logStyles.fg.green}The database is properly set up and working.${logStyles.reset}`);
    }
}

// Run the main function
main().catch(err => {
    console.error(`${logStyles.fg.red}Unhandled error: ${err.message}${logStyles.reset}`);
});