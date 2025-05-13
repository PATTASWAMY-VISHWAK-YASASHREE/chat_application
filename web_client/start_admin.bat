@echo off
echo.
echo ===================================================
echo           GALAXY CHAT - ADMIN SERVER
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

echo Starting Admin Server on port 5059...
echo.
echo ===================================================
echo.

call node server.js admin

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Server failed to start!
    echo.
    pause
)

pause