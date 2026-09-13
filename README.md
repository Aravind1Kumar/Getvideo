# AK Downloader & Panda Compressor 🐼🚀

A fast, full-stack video downloader & compression application built with React, Vite, Tailwind CSS, FastAPI, yt-dlp, and FFmpeg.

## 🌟 Key Features

1. **Multi-Source Video Downloader**:
   - Downloads videos from **1800+ websites** (YouTube, TikTok, Instagram, Twitter/X, Facebook, Vimeo, Reddit, Dailymotion, etc.).
   - Live real-time download progress with speed and ETA.
   - Choose from high definition (1080p, 720p, 480p) or audio-only (MP3).

2. **Panda Video Compressor 🐼**:
   - **Small File (Easy Share)**: Up to 80% reduction for WhatsApp, Discord, or low data.
   - **Medium Quality**: Balanced crispness for standard storage and social uploads.
   - **Just Compress (High Quality)**: Re-encodes at original resolution with zero visible quality loss.
   - **Fit to WhatsApp (< 16 MB)**: Target bitrate calculation to guarantee final size < 16 MB.
   - **Fit to Email (< 25 MB)**: Target bitrate calculation to fit email attachment limits.
   - Available both as a **standalone drag-and-drop compressor** and an **auto-compress on download** option!

3. **Android APK Ready**:
   - Pre-configured with Capacitor for native Android deployment.

---

## 💻 How to Run Locally

### 1. Start Backend (Terminal 1)
Double-click `start_backend.bat`  
OR run:
```bash
C:\Users\lenovo\.conda\envs\PythonProject\python.exe backend\main.py
```
Backend runs at: **http://localhost:8000**

### 2. Start Frontend (Terminal 2)
Double-click `start_frontend.bat`  
OR run:
```bash
cd frontend
npm run dev
```
Frontend runs at: **http://localhost:5173**

---

## 📱 How to Build the Android APK

Just like the `ak_cut` project, this app uses **Capacitor**:

1. **One-click Build**:
   Double-click `build_apk.bat`
2. **Or Manual Steps**:
   ```bash
   cd frontend
   npm run build
   npx cap sync android
   npx cap open android
   ```
3. In **Android Studio**, click **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**.
4. Transfer the generated `.apk` file to your phone and install!

> **Note for Wi-Fi connection:** When testing the APK on your phone connected to the same Wi-Fi, click the ⚙️ **Settings** icon in the app header and set the server URL to your PC's IP (e.g. `http://192.168.1.3:8000`).

---

## 📁 Downloads Location
Downloaded and compressed files are saved locally to:  
`C:\Users\lenovo\Downloads\AKDownloader\`
