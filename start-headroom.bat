@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set HEADROOM_PORT=8787
set "HEADROOM_EXE=%~dp0.external\headroom\.venv\Scripts\headroom.exe"
set "HEADROOM_LOG=%~dp0.external\headroom\proxy.log"
set "KILLED_PIDS= "

if not exist "%HEADROOM_EXE%" (
  echo Headroom is not installed: %HEADROOM_EXE%
  echo Install it in .external\headroom\.venv and run this script again.
  exit /b 1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%HEADROOM_PORT% ^| findstr LISTENING') do (
  call :kill_pid Headroom %%a
)

echo Starting Headroom on http://127.0.0.1:%HEADROOM_PORT% ...
echo Logs: .external\headroom\proxy.log
start "Headroom" "%HEADROOM_EXE%" proxy --port %HEADROOM_PORT% --mode cache --no-ccr-inject-tool --lossless --log-file "%HEADROOM_LOG%"

echo Headroom started in a new window. Close it to stop Headroom.
echo To stop: npm run headroom:stop
exit /b 0

:kill_pid
echo %KILLED_PIDS% | findstr /c:" %2 " >nul
if not errorlevel 1 exit /b 0
set "KILLED_PIDS=%KILLED_PIDS%%2 "
echo Killing %1 PID %2...
taskkill /PID %2 /T /F >nul 2>&1
exit /b 0
