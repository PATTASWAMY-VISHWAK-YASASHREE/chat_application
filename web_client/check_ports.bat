@echo off
echo.
echo ===================================================
echo           PORT AVAILABILITY CHECK
echo ===================================================
echo.

echo Checking if ports are available...
echo.

node server_port_check.js

echo.
echo If port 8080 is already in use, try using a different port
echo in the server.js file.
echo.

pause