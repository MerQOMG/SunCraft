@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js was not found. Open SunCraft demo HTML or use start-demo.cmd in the parent folder.
 pause
 exit /b 1
)
node scripts\preview.cjs
if errorlevel 1 pause
