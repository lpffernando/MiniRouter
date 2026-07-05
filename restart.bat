@echo off
setlocal EnableExtensions
REM Restart MiniRouter (Headroom removed — start separately if needed)

set MINIROUTER_PORT=8402

REM Kill MiniRouter on port 8402.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%MINIROUTER_PORT% ^| findstr LISTENING') do (
  echo Killing MiniRouter PID %%a...
  taskkill /PID %%a /T /F >nul 2>&1
)
ping -n 3 127.0.0.1 >nul

REM Start MiniRouter in current window.
echo Starting MiniRouter on http://localhost:%MINIROUTER_PORT%...
npx tsx src/server/serve.ts
exit /b %ERRORLEVEL%
