@echo off
echo.
echo ===================================================
echo           GALAXY CHAT - USER SERVER (ALT PORT)
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

echo Starting User Server on port 3000...
echo.
echo ===================================================
echo.

echo IMPORTANT: Open your browser to http://localhost:3000
echo.

node server_alt_port.js user

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Server failed to start!
    echo.
    pause
)

pause