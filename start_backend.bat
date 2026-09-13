@echo off
echo ================================
echo   AK Downloader - Backend
echo ================================
echo.

cd /d "%~dp0backend"

set PYTHON=C:\Users\lenovo\.conda\envs\PythonProject\python.exe

echo [1/3] Checking Python...
"%PYTHON%" --version
if %errorlevel% neq 0 (
    echo ERROR: Python not found at %PYTHON%
    pause
    exit /b 1
)

echo.
echo [2/3] Ensuring dependencies are installed...
"%PYTHON%" -m pip install fastapi uvicorn yt-dlp python-multipart --quiet

echo.
echo [3/3] Starting backend server on http://localhost:8000
echo.
"%PYTHON%" main.py
pause

