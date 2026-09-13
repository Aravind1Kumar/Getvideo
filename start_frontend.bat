@echo off
echo ================================
echo   AK Downloader - Frontend
echo ================================
echo.

cd /d "%~dp0frontend"

echo [1/2] Installing npm packages...
call npm install

echo.
echo [2/2] Starting frontend on http://localhost:5173
echo.
call npm run dev
pause
