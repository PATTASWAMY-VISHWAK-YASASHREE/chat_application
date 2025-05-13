@echo off
echo Combining server parts into a single file...

type server.js > temp_server.js
type server_part2.js >> temp_server.js
type server_part3.js >> temp_server.js
type server_part4.js >> temp_server.js
type server_part5.js >> temp_server.js
type server_part6.js >> temp_server.js
type server_part7.js >> temp_server.js
type server_part8.js >> temp_server.js

move /y temp_server.js server.js

echo Server file combined successfully!
pause