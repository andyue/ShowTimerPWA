@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\ws\index.js (
  echo First-time setup: downloading dependencies. Internet is required.
  call npm ci
  if errorlevel 1 goto failed
)
set "OSC_HOST=0.0.0.0"
echo Starting OSC for localhost and trusted private-network controllers.
call npm run osc:bridge
if errorlevel 1 goto failed
exit /b 0
:failed
echo ShowTimer could not start. Please read the error above.
pause
exit /b 1
