-- Chat Application Database Setup Script
-- This script creates the necessary tables for the chat application

-- Create database if it doesn't exist
-- Note: This command works in PostgreSQL command line but not in pgAdmin
-- CREATE DATABASE IF NOT EXISTS chat_application;

-- Connect to the database
-- \c chat_application;

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS room_messages CASCADE;
DROP TABLE IF EXISTS room_members CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_users CASCADE;

-- Create users table
CREATE TABLE chat_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    last_seen TIMESTAMP,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    theme VARCHAR(50) DEFAULT 'default',
    font_size INTEGER DEFAULT 12,
    notification_preference VARCHAR(20) DEFAULT 'all'
);

-- Create messages table
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_private BOOLEAN DEFAULT FALSE,
    recipient_id INTEGER NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    read_status BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (sender_id) REFERENCES chat_users (id),
    FOREIGN KEY (recipient_id) REFERENCES chat_users (id)
);

-- Create chat rooms table
CREATE TABLE chat_rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    is_private BOOLEAN DEFAULT FALSE,
    room_theme VARCHAR(50) DEFAULT 'default',
    FOREIGN KEY (created_by) REFERENCES chat_users (id)
);

-- Create room members table
CREATE TABLE room_members (
    room_id INTEGER,
    user_id INTEGER,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_admin BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
    FOREIGN KEY (user_id) REFERENCES chat_users (id)
);

-- Create room messages table
CREATE TABLE room_messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER,
    sender_id INTEGER,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
    FOREIGN KEY (sender_id) REFERENCES chat_users (id)
);

-- Create indexes for better performance
CREATE INDEX idx_messages_timestamp ON chat_messages (timestamp);
CREATE INDEX idx_room_messages_timestamp ON room_messages (timestamp);
CREATE INDEX idx_room_messages_room_id ON room_messages (room_id);
CREATE INDEX idx_messages_sender ON chat_messages (sender_id);
CREATE INDEX idx_messages_recipient ON chat_messages (recipient_id);
CREATE INDEX idx_users_username ON chat_users (username);

-- Insert some sample data
INSERT INTO chat_users (username, last_seen, theme) 
VALUES 
('Admin', NOW(), 'dark'),
('Alice', NOW(), 'default'),
('Bob', NOW(), 'light_blue'),
('Charlie', NOW(), 'forest');

-- Insert some sample messages
INSERT INTO chat_messages (sender_id, message, timestamp, message_type) 
VALUES 
(1, 'Welcome to the chat application!', NOW() - INTERVAL '1 hour', 'text'),
(2, 'Hello everyone!', NOW() - INTERVAL '50 minutes', 'text'),
(3, 'Hi Alice, how are you?', NOW() - INTERVAL '45 minutes', 'text'),
(2, 'I''m doing great, thanks for asking!', NOW() - INTERVAL '40 minutes', 'text');

-- Insert a private message
INSERT INTO chat_messages (sender_id, message, timestamp, message_type, is_private, recipient_id) 
VALUES 
(2, 'Hey Bob, this is a private message.', NOW() - INTERVAL '30 minutes', 'text', TRUE, 3);

-- Create a sample room
INSERT INTO chat_rooms (name, description, created_by, is_private) 
VALUES 
('General', 'General discussion room', 1, FALSE);

-- Add members to the room
INSERT INTO room_members (room_id, user_id, is_admin) 
VALUES 
(1, 1, TRUE),
(1, 2, FALSE),
(1, 3, FALSE),
(1, 4, FALSE);

-- Add some room messages
INSERT INTO room_messages (room_id, sender_id, message, timestamp) 
VALUES 
(1, 1, 'Welcome to the General room!', NOW() - INTERVAL '2 hours'),
(1, 2, 'Thanks for creating this room!', NOW() - INTERVAL '1 hour 55 minutes');

-- Print success message
SELECT 'Database setup completed successfully!' AS result;