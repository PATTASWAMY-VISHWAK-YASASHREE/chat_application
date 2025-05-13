// Try to connect to the database
async function checkDatabaseConnection() {
    console.log(`${logStyles.bright}${logStyles.fg.cyan}[DATABASE]${logStyles.reset} Attempting to connect to PostgreSQL database...`);
    console.log(`${logStyles.dim}Host: ${config.DB_CONFIG.host}, Database: ${config.DB_CONFIG.database}, User: ${config.DB_CONFIG.user}${logStyles.reset}`);
    
    const pool = new Pool(config.DB_CONFIG);
    try {
        const client = await pool.connect();
        
        // Test query to verify connection
        const result = await client.query('SELECT version()');
        const pgVersion = result.rows[0].version;
        
        console.log(`${logStyles.bright}${logStyles.fg.green}[DATABASE]${logStyles.reset} Connection successful!`);
        console.log(`${logStyles.fg.green}PostgreSQL version: ${pgVersion}${logStyles.reset}`);
        console.log(`${logStyles.bright}${logStyles.fg.green}[DATABASE]${logStyles.reset} Message persistence enabled`);
        
        client.release();
        dbAvailable = true;
        return true;
    } catch (err) {
        console.log(`${logStyles.bright}${logStyles.fg.red}[DATABASE]${logStyles.reset} Connection failed: ${err.message}`);
        console.log(`${logStyles.bright}${logStyles.fg.yellow}[DATABASE]${logStyles.reset} Running in no-database mode`);
        console.log(`${logStyles.fg.yellow}Messages will not be persisted${logStyles.reset}`);
        dbAvailable = false;
        return false;
    } finally {
        await pool.end();
    }
}

// Save message to database
async function saveMessageToDatabase(username, message, messageType = 'text', isPrivate = false, recipient = null) {
    if (!dbAvailable) return;
    
    const pool = new Pool(config.DB_CONFIG);
    try {
        const client = await pool.connect();
        
        // Get user ID
        const userResult = await client.query(
            'SELECT id FROM chat_users WHERE username = $1',
            [username]
        );
        
        let userId;
        if (userResult.rows.length > 0) {
            userId = userResult.rows[0].id;
        } else {
            // Create user
            const newUserResult = await client.query(
                'INSERT INTO chat_users (username, last_seen) VALUES ($1, NOW()) RETURNING id',
                [username]
            );
            userId = newUserResult.rows[0].id;
            console.log(`${logStyles.fg.cyan}[DB]${logStyles.reset} Created new user: ${username}`);
        }
        
        // Get recipient ID if private message
        let recipientId = null;
        if (isPrivate && recipient) {
            const recipientResult = await client.query(
                'SELECT id FROM chat_users WHERE username = $1',
                [recipient]
            );
            
            if (recipientResult.rows.length > 0) {
                recipientId = recipientResult.rows[0].id;
            } else {
                // Create recipient user
                const newRecipientResult = await client.query(
                    'INSERT INTO chat_users (username, last_seen) VALUES ($1, NOW()) RETURNING id',
                    [recipient]
                );
                recipientId = newRecipientResult.rows[0].id;
                console.log(`${logStyles.fg.cyan}[DB]${logStyles.reset} Created new user: ${recipient}`);
            }
        }
        
        // Save message
        await client.query(
            'INSERT INTO chat_messages (sender_id, message, timestamp, message_type, is_private, recipient_id) VALUES ($1, $2, NOW(), $3, $4, $5)',
            [userId, message, messageType, isPrivate, recipientId]
        );
        
        client.release();
    } catch (err) {
        console.error(`${logStyles.fg.red}[DB ERROR]${logStyles.reset} Error saving message to database: ${err}`);
    } finally {
        await pool.end();
    }
}