@echo off
echo ===============================================
echo   Building AK Downloader & Panda Compress APK
echo ===============================================
echo.

cd /d "%~dp0frontend"

echo [1/3] Building Web Assets with Vite...
call npm run build

echo.
echo [2/3] Syncing Assets into Native Android Project...
call npx cap sync android

echo.
echo [3/3] Opening Project in Android Studio...
echo (In Android Studio, click: Build -^> Build Bundle(s) / APK(s) -^> Build APK(s))
call npx cap open android

pause
