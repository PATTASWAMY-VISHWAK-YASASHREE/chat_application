@echo off
echo.
echo ===================================================
echo           GALAXY CHAT LAUNCHER
echo ===================================================
echo.

set PORT=5059
if not "%~1"=="" set PORT=%~1

echo Installing dependencies...
call npm install

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

echo Checking database connection...
call node db/check_database.js --quick

echo.
echo Starting chat server on port %PORT%...
echo.
echo ===================================================
echo.

call node server.js %PORT%

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Server failed to start!
    echo.
    pause
)

pause