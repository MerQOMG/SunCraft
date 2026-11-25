@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0.tools\node-v24.22.3-win-x64\node.exe" set "PATH=%~dp0.tools\node-v24.22.3-win-x64;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 22.12+ or 24 LTS is required. See README.md.
 pause
 exit /b 1
)
if not exist node_modules (
 call npm ci --no-fund
 if errorlevel 1 exit /b 1
)
call npm run dev
pause
