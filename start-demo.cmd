@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
rem Open the self-contained demo. No Python or Node.js installation is required.
if not exist "%~dp0夏遮冬透.html" (
  echo SunCraft demo HTML is missing. See README.md.
  pause
  exit /b 1
)
start "" "%~dp0夏遮冬透.html"
exit /b 0
