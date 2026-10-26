@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\vite\bin\vite.js (
  echo First-time setup: downloading dependencies. Internet is required.
  call npm ci
  if errorlevel 1 goto failed
)
call npm run lan
if errorlevel 1 goto failed
exit /b 0
:failed
echo ShowTimer could not start. Please read the error above.
pause
exit /b 1
