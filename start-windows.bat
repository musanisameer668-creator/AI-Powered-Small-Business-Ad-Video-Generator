@echo off
title AdMitra
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org then run this again. & pause & exit /b 1)
if not exist backend\.env copy backend\.env.example backend\.env >nul
if not exist backend\node_modules (
  echo Installing packages, this takes a minute the first time...
  call npm --prefix backend install || (echo Install failed. See the message above. & pause & exit /b 1)
)
echo.
echo Starting AdMitra. Open http://localhost:5000 in your browser.
echo Close this window to stop it.
echo.
start "" http://localhost:5000
call npm --prefix backend start
pause
