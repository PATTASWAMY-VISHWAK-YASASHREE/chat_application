# Galaxy Chat Application

A multi-server chat application with admin approval system and PostgreSQL database integration.

## Setup and Running

### Prerequisites
- Node.js
- PostgreSQL (optional)

### Installation
1. Install dependencies:
   ```
   npm install ws pg
   ```

### Running the Application

#### Option 1: Run Admin and User Servers Separately (Recommended)
1. Start the Admin Server:
   ```
   start_admin_server.bat
   ```
   This will start the admin server on port 5059 and open the admin interface.

2. Start the User Server:
   ```
   start_user_server.bat
   ```
   This will start the user server on port 5000 and open the user interface.

#### Option 2: Run Both Servers Together
```
start_all_auto.bat
```
This will start both admin and user servers with automatic port selection.

## Usage

### Admin Interface
1. Open http://localhost:5059/admin.html
2. Login with username "Admin" and password "admin123"
3. Approve or deny user access requests

### User Interface
1. Open http://localhost:5000
2. Enter a username and connect
3. If not approved, you'll be prompted to request access
4. Once approved, you can join the chat

## Troubleshooting

### Connection Issues
- Make sure both servers are running
- Check the console for port information
- Ensure you're using the correct URLs

### Admin Login Issues
- Only one admin can be connected at a time
- Use the admin.html page for admin login
- Make sure you're connecting to the admin server port

### User Approval Issues
- Admin must be logged in to approve users
- Check both server consoles for error messages
- Restart both servers if issues persist