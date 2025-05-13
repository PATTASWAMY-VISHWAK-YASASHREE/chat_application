/**
 * Database Setup Script
 * This script sets up the PostgreSQL database for the chat application
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const readline = require('readline');

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
    console.log(`${logStyles.bright}${logStyles.fg.cyan}║                DATABASE SETUP UTILITY                      ║${logStyles.reset}`);
    console.log(`${logStyles.bright}${logStyles.fg.cyan}║                                                            ║${logStyles.reset}`);
    console.log(`${logStyles.bright}${logStyles.fg.cyan}╚════════════════════════════════════════════════════════════╝${logStyles.reset}`);
    console.log('\n');
}

// Create a readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Ask user for confirmation
function askForConfirmation(message) {
    return new Promise((resolve) => {
        rl.question(`${message} (y/n): `, (answer) => {
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

// Check if database exists
async function checkDatabaseExists() {
    // Connect to PostgreSQL without specifying a database
    const pool = new Pool({
        user: DB_CONFIG.user,
        host: DB_CONFIG.host,
        password: DB_CONFIG.password,
        port: DB_CONFIG.port,
        database: 'postgres' // Connect to default database
    });
    
    try {
        const client = await pool.connect();
        
        // Check if our database exists
        const result = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [DB_CONFIG.database]
        );
        
        const exists = result.rowCount > 0;
        client.release();
        await pool.end();
        
        return exists;
    } catch (err) {
        console.error(`${logStyles.fg.red}Error checking database: ${err.message}${logStyles.reset}`);
        await pool.end();
        return false;
    }
}

// Create database if it doesn't exist
async function createDatabase() {
    // Connect to PostgreSQL without specifying a database
    const pool = new Pool({
        user: DB_CONFIG.user,
        host: DB_CONFIG.host,
        password: DB_CONFIG.password,
        port: DB_CONFIG.port,
        database: 'postgres' // Connect to default database
    });
    
    try {
        const client = await pool.connect();
        
        // Create the database
        await client.query(`CREATE DATABASE ${DB_CONFIG.database}`);
        
        console.log(`${logStyles.fg.green}Database '${DB_CONFIG.database}' created successfully${logStyles.reset}`);
        
        client.release();
        await pool.end();
        return true;
    } catch (err) {
        console.error(`${logStyles.fg.red}Error creating database: ${err.message}${logStyles.reset}`);
        await pool.end();
        return false;
    }
}

// Execute SQL script
async function executeSqlScript() {
    const pool = new Pool(DB_CONFIG);
    
    try {
        const client = await pool.connect();
        
        // Read SQL file
        const sqlFilePath = path.join(__dirname, 'setup_database.sql');
        const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
        
        console.log(`${logStyles.fg.cyan}Executing SQL script...${logStyles.reset}`);
        
        // Execute the script
        await client.query(sqlScript);
        
        console.log(`${logStyles.fg.green}SQL script executed successfully${logStyles.reset}`);
        
        // Verify tables were created
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log(`${logStyles.fg.green}Created tables:${logStyles.reset}`);
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
        // Check if sample data was inserted
        const usersCount = await client.query('SELECT COUNT(*) FROM chat_users');
        const messagesCount = await client.query('SELECT COUNT(*) FROM chat_messages');
        
        console.log(`${logStyles.fg.green}Inserted sample data:${logStyles.reset}`);
        console.log(`  - Users: ${usersCount.rows[0].count}`);
        console.log(`  - Messages: ${messagesCount.rows[0].count}`);
        
        client.release();
        await pool.end();
        return true;
    } catch (err) {
        console.error(`${logStyles.fg.red}Error executing SQL script: ${err.message}${logStyles.reset}`);
        await pool.end();
        return false;
    }
}

// Main function
async function main() {
    printBanner();
    
    console.log(`${logStyles.fg.cyan}Checking PostgreSQL connection...${logStyles.reset}`);
    
    // Check if database exists
    const dbExists = await checkDatabaseExists();
    
    if (dbExists) {
        console.log(`${logStyles.fg.yellow}Database '${DB_CONFIG.database}' already exists${logStyles.reset}`);
        
        // Ask for confirmation to reset the database
        const shouldReset = await askForConfirmation('Do you want to reset the database? This will delete all existing data');
        
        if (!shouldReset) {
            console.log(`${logStyles.fg.yellow}Database setup cancelled${logStyles.reset}`);
            rl.close();
            return;
        }
    } else {
        console.log(`${logStyles.fg.yellow}Database '${DB_CONFIG.database}' does not exist${logStyles.reset}`);
        
        // Create the database
        const created = await createDatabase();
        if (!created) {
            console.log(`${logStyles.fg.red}Failed to create database. Setup cancelled.${logStyles.reset}`);
            rl.close();
            return;
        }
    }
    
    // Execute SQL script
    const success = await executeSqlScript();
    
    if (success) {
        console.log(`\n${logStyles.bright}${logStyles.fg.green}Database setup completed successfully!${logStyles.reset}`);
        console.log(`${logStyles.fg.green}The chat server can now store and retrieve messages.${logStyles.reset}`);
    } else {
        console.log(`\n${logStyles.bright}${logStyles.fg.red}Database setup failed.${logStyles.reset}`);
        console.log(`${logStyles.fg.yellow}The chat server will run in no-database mode.${logStyles.reset}`);
    }
    
    rl.close();
}

// Run the main function
main().catch(err => {
    console.error(`${logStyles.fg.red}Unhandled error: ${err.message}${logStyles.reset}`);
    rl.close();
});