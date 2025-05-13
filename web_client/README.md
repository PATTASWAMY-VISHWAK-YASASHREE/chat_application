# Web-based Chat Application

This is a web-based version of the chat application with a modern interface using HTML, CSS, and JavaScript.

## Features

- Modern Bootstrap UI with responsive design
- Multiple chat windows in a single browser tab
- Private messaging with user selection
- End-to-end encryption for private messages
- Typing indicators
- Theme selection
- WebSocket communication
- Optional database integration

## How to Run

1. Install Node.js if you don't have it already
2. Open a terminal in this directory
3. Run `npm install` to install dependencies
4. Run `npm start` to start the server
5. Open your browser to `http://localhost:5059`
6. Open multiple browser tabs to simulate multiple users

## Database Support

The server will automatically detect if PostgreSQL is available:
- If PostgreSQL is running and configured, messages will be saved to the database
- If PostgreSQL is not available, the server will run in "no database" mode

## Using the Chat

1. Enter a username and click "Connect"
2. Send messages in the public chat
3. Click on a user in the sidebar to start a private chat
4. Use the theme selector to change the appearance

## Performance Improvements

- Messages are processed serially to prevent overloading
- Encryption key generation is faster
- Database operations are optional