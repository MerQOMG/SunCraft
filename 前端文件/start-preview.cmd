@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0.tools\node-v24.22.3-win-x64\node.exe" set "PATH=%~dp0.tools\node-v24.22.3-win-x64;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
 echo No Node.js found. Double-click SunCraft offline HTML instead.
 pause
 exit /b 1
)
node scripts\preview.cjs
pause
