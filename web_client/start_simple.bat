@echo off
echo.
echo ===================================================
echo           SIMPLE CHAT - NO DATABASE
echo ===================================================
echo.

echo Starting Simple Chat Server on port 8080...
echo.
echo IMPORTANT: Open your browser to http://localhost:8080
echo.

echo Copying simple_index.html to index.html...
copy simple_index.html index.html /Y

echo.
echo Starting server...
node no_db_server.js user

pause