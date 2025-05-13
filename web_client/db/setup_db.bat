@echo off
echo.
echo ===================================================
echo           DATABASE SETUP UTILITY
echo ===================================================
echo.

echo Installing required dependencies...
call npm install pg

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies!
    echo Please make sure Node.js is installed on your system.
    echo.
    pause
    exit /b 1
)

echo.
echo Running database setup script...
echo.

node setup_database.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Database setup failed!
    echo.
    pause
    exit /b 1
)

echo.
echo Database setup completed.
echo.
pause