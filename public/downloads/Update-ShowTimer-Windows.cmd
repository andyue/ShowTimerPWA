@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 from https://nodejs.org/download/release/latest-v24.x/
  pause
  exit /b 1
)
echo Export your Show File backup and stop the LAN server and OSC bridge before updating.
echo The latest tested version will be installed in your user folder under ShowTimer.
pause
set "SHOWTIMER_UPDATE_FILE=%TEMP%\showtimer-update-%RANDOM%-%RANDOM%.mjs"
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/andyue/ShowTimerPWA/main/scripts/update-lan.mjs' -OutFile $env:SHOWTIMER_UPDATE_FILE"
if errorlevel 1 goto failed
node "%SHOWTIMER_UPDATE_FILE%"
if errorlevel 1 goto failed
del "%SHOWTIMER_UPDATE_FILE%" >nul 2>nul
pause
exit /b 0
:failed
if exist "%SHOWTIMER_UPDATE_FILE%" del "%SHOWTIMER_UPDATE_FILE%" >nul 2>nul
echo Update or startup failed. Your old version is unchanged. Read the error above.
pause
exit /b 1
