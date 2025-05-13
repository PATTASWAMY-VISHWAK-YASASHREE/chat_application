@echo off
echo.
echo ===================================================
echo       GALAXY CHAT - AUTO PORT MULTI-SERVER LAUNCHER
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

echo Starting Admin Server with automatic port selection...
start cmd /k "title Galaxy Chat - Admin Server && node fixed_server.js admin"

echo Starting User Server with automatic port selection...
start cmd /k "title Galaxy Chat - User Server && node fixed_server.js user"

echo.
echo ===================================================
echo Both servers started successfully!
echo.
echo Check the server windows for the actual ports being used.
echo ===================================================
echo.

pause