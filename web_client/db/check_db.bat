@echo off
echo.
echo ===================================================
echo           DATABASE CHECK UTILITY
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
echo Running database check script...
echo.

node check_database.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Database check failed!
    echo.
    pause
    exit /b 1
)

echo.
echo Database check completed.
echo.
pause