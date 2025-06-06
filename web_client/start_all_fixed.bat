@echo off
echo.
echo ===================================================
echo           GALAXY CHAT - FIXED MULTI-SERVER LAUNCHER
echo ===================================================
echo.

echo Installing dependencies...
call npm install ws

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies!
    echo Please make sure Node.js is installed on your system.
    echo.
    pause
    exit /b 1
)

echo.
echo Dependencies installed successfully!
echo.

echo Starting Admin Server (Port 5059)...
start cmd /k "title Galaxy Chat - Admin Server && node fixed_server.js admin"

echo Starting User Server (Port 5000)...
start cmd /k "title Galaxy Chat - User Server && node fixed_server.js user"

echo.
echo ===================================================
echo Both servers started successfully!
echo.
echo Admin interface: http://localhost:5059
echo User interface: http://localhost:5000
echo ===================================================
echo.

pause