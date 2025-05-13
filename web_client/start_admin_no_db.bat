@echo off
echo.
echo ===================================================
echo           GALAXY CHAT - ADMIN (NO DATABASE MODE)
echo ===================================================
echo.

echo Starting Admin Server on port 5059 (NO DATABASE)...
echo.
echo IMPORTANT: Open your browser to http://localhost:5059
echo.

node no_db_server.js admin

pause