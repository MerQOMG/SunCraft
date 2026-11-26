@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo 这是旧入口（端口 8000，离线 HTML 演示），不是当前开发入口。
echo 请使用根目录的 start-dev.cmd，并在浏览器打开：
echo http://127.0.0.1:5174/
echo ============================================================
echo.
echo 如果仍要启动旧的 8000 端口演示，请按任意键继续；否则请关闭本窗口。
pause

set "DEMO_PY=.venv-demo\Scripts\python.exe"
if exist "%DEMO_PY%" goto install
python -m venv .venv-demo
if errorlevel 1 py -3 -m venv .venv-demo
if not exist "%DEMO_PY%" goto fail

:install
if not exist "wheels\" goto online
"%DEMO_PY%" -m pip install --disable-pip-version-check --no-index --find-links wheels -r backend\requirements.txt
if not errorlevel 1 goto run

:online
"%DEMO_PY%" -m pip install --disable-pip-version-check -r backend\requirements.txt
if errorlevel 1 goto fail

:run
echo Open http://127.0.0.1:8000 in your browser.
echo 这是旧入口。当前程序请改用 start-dev.cmd 打开 http://127.0.0.1:5174/
echo In Connection Settings, select FastAPI and apply. Press Ctrl+C here to stop.
"%DEMO_PY%" -m uvicorn --app-dir backend suncraft.demo:app --host 127.0.0.1 --port 8000
if not errorlevel 1 exit /b 0
:fail
echo SunCraft could not start. See the messages above.
pause
exit /b 1
