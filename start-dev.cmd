@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dev.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo 启动失败。请查看上面的说明，或阅读 README.md。
  pause
  exit /b %ERR%
)
echo.
pause
