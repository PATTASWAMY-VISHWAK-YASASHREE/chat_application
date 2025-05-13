@echo off
echo.
echo ===================================================
echo           GALAXY CHAT - FIXED SERVER
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

echo Starting User Server on port 5000...
echo.
echo IMPORTANT: Open your browser to http://localhost:5000
echo.

node fixed_server.js user

pause