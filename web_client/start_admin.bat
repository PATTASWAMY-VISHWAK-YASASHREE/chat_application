@echo off
echo.
echo ===================================================
echo           GALAXY CHAT - ADMIN SERVER
echo ===================================================
echo.

echo Installing dependencies...
call npm install ws pg

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

echo Starting Admin Server...
echo.
echo IMPORTANT: Use the admin.html page to connect as admin
echo.

start http://localhost:5059/admin.html
node fixed_server.js admin

pause