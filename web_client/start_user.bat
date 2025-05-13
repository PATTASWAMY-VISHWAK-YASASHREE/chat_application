@echo off
echo.
echo ===================================================
echo           GALAXY CHAT - USER SERVER
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

echo Starting User Server...
echo.
echo IMPORTANT: Open your browser to http://localhost:5000
echo.
echo NOTE: You will need admin approval to join the chat
echo.

start http://localhost:5000
node fixed_server.js user

pause