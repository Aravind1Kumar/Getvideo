# AK Downloader

A fast, beautiful video downloader web app that downloads videos from **1800+ websites** using yt-dlp.

## Supported Sites
YouTube, TikTok, Instagram, Twitter/X, Facebook, Vimeo, Reddit, Dailymotion, Twitch, and 1800+ more.

## How to Run

### 1. Start Backend (Terminal 1)
Double-click `start_backend.bat`  
OR manually:
```
C:\Users\lenovo\.conda\envs\PythonProject\python.exe backend\main.py
```
Backend runs at: **http://localhost:8000**

### 2. Start Frontend (Terminal 2)
Double-click `start_frontend.bat`  
OR manually:
```
cd frontend
npm run dev
```
Frontend runs at: **http://localhost:5173**

### 3. Open in Browser
Go to **http://localhost:5173** — paste any video URL and download!

## Downloads Location
Files are saved to: `C:\Users\lenovo\Downloads\AKDownloader\`

## Project Structure
```
ak_downloader/
├── backend/
│   ├── main.py              # FastAPI server
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx           # Main app
│       ├── components/
│       │   ├── VideoCard.tsx
│       │   ├── ProgressBar.tsx
│       │   └── QualitySelector.tsx
│       └── types.ts
├── start_backend.bat
└── start_frontend.bat
```
