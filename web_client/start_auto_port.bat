@echo off
echo.
echo ===================================================
echo           GALAXY CHAT - AUTO PORT SERVER
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

echo Starting User Server with automatic port selection...
echo.
echo The server will automatically find an available port.
echo.

node fixed_server.js user

pause