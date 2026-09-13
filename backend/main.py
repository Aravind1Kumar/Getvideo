import os
import re
import json
import uuid
import asyncio
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="AK Downloader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOADS_DIR = Path.home() / "Downloads" / "AKDownloader"
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

YTDLP_PATH = r"C:\Users\lenovo\.conda\envs\PythonProject\Scripts\yt-dlp.exe"


def get_ytdlp() -> str:
    if Path(YTDLP_PATH).exists():
        return YTDLP_PATH
    # fallback: try system path
    for candidate in ["yt-dlp", "yt-dlp.exe"]:
        try:
            subprocess.run([candidate, "--version"], capture_output=True, timeout=5)
            return candidate
        except Exception:
            pass
    raise RuntimeError("yt-dlp not found")


def has_ffmpeg() -> bool:
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return r.returncode == 0
    except Exception:
        pass
    # also check conda env Scripts
    ffmpeg_paths = [
        r"C:\Users\lenovo\.conda\envs\PythonProject\Scripts\ffmpeg.exe",
        r"C:\Users\lenovo\anaconda3\Scripts\ffmpeg.exe",
    ]
    return any(Path(p).exists() for p in ffmpeg_paths)


def get_ffmpeg() -> Optional[str]:
    # 1. System ffmpeg
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        if r.returncode == 0:
            return "ffmpeg"
    except Exception:
        pass

    # 2. Conda env Scripts
    for p in [
        r"C:\Users\lenovo\.conda\envs\PythonProject\Scripts\ffmpeg.exe",
        r"C:\Users\lenovo\anaconda3\Scripts\ffmpeg.exe",
    ]:
        if Path(p).exists():
            return p

    # 3. imageio-ffmpeg bundled binary
    try:
        import imageio_ffmpeg  # type: ignore
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        if ffmpeg_exe and Path(ffmpeg_exe).exists():
            return ffmpeg_exe
    except Exception:
        pass

    return None


class UrlRequest(BaseModel):
    url: str


@app.get("/api/health")
def health():
    ffmpeg = get_ffmpeg()
    return {
        "status": "ok",
        "ffmpeg": ffmpeg is not None,
        "ffmpeg_path": ffmpeg,
        "downloads_dir": str(DOWNLOADS_DIR),
    }


@app.post("/api/info")
async def get_info(req: UrlRequest):
    """Fetch video metadata from a URL."""
    try:
        ytdlp = get_ytdlp()
        result = subprocess.run(
            [ytdlp, "--dump-json", "--no-playlist", "--no-warnings", req.url],
            capture_output=True, text=True, timeout=30, encoding="utf-8", errors="replace"
        )

        if result.returncode != 0:
            err = result.stderr.strip() or "Unable to fetch video info"
            raise HTTPException(status_code=400, detail=err)

        data = json.loads(result.stdout)
        ffmpeg_ok = get_ffmpeg() is not None

        formats = []

        if ffmpeg_ok:
            # With ffmpeg: offer quality-merged downloads
            for h in [2160, 1440, 1080, 720, 480, 360, 240]:
                has_height = any(
                    f.get("height") == h
                    for f in data.get("formats", [])
                    if f.get("vcodec", "none") != "none"
                )
                if has_height:
                    formats.append({
                        "id": f"bestvideo[height<={h}]+bestaudio/best[height<={h}]",
                        "label": f"{h}p (best)",
                        "height": h,
                        "ext": "mp4",
                        "filesize": None,
                        "type": "video",
                        "needs_ffmpeg": True,
                    })
            # Fallback if no specific heights found
            if not formats:
                formats.append({
                    "id": "bestvideo+bestaudio/best",
                    "label": "Best quality",
                    "height": 9999,
                    "ext": "mp4",
                    "filesize": None,
                    "type": "video",
                    "needs_ffmpeg": True,
                })
            # Audio
            formats.append({
                "id": "bestaudio/best",
                "label": "Audio only (MP3)",
                "height": 0,
                "ext": "mp3",
                "filesize": None,
                "type": "audio",
                "needs_ffmpeg": True,
            })
        else:
            # Without ffmpeg: only pre-merged formats work reliably
            # Collect pre-merged video formats (have both vcodec and acodec)
            seen = set()
            native_formats = []
            for fmt in reversed(data.get("formats", [])):
                vcodec = fmt.get("vcodec", "none")
                acodec = fmt.get("acodec", "none")
                height = fmt.get("height")
                ext = fmt.get("ext", "mp4")
                fmt_id = fmt.get("format_id", "")
                filesize = fmt.get("filesize") or fmt.get("filesize_approx")

                if vcodec != "none" and acodec != "none" and height and ext not in ("mhtml",):
                    label = f"{height}p ({ext})"
                    if label not in seen:
                        seen.add(label)
                        native_formats.append({
                            "id": fmt_id,
                            "label": label,
                            "height": height,
                            "ext": ext,
                            "filesize": filesize,
                            "type": "video",
                            "needs_ffmpeg": False,
                        })

            if native_formats:
                formats = native_formats[:8]  # top 8 options
            else:
                # Absolute fallback
                formats = [{
                    "id": "best",
                    "label": "Best available",
                    "height": 0,
                    "ext": "mp4",
                    "filesize": None,
                    "type": "video",
                    "needs_ffmpeg": False,
                }]

        return {
            "title": data.get("title", "Unknown"),
            "thumbnail": data.get("thumbnail", ""),
            "duration": data.get("duration", 0),
            "uploader": data.get("uploader") or data.get("channel", "Unknown"),
            "view_count": data.get("view_count"),
            "like_count": data.get("like_count"),
            "description": (data.get("description") or "")[:200],
            "webpage_url": data.get("webpage_url", req.url),
            "extractor": data.get("extractor_key", ""),
            "formats": formats,
            "ffmpeg_available": ffmpeg_ok,
        }

    except HTTPException:
        raise
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Could not parse video info")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Timed out fetching video info")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download")
async def download_video(url: str, format_id: str, title: str = "video"):
    """Stream download with real-time SSE progress."""
    safe_title = re.sub(r'[\\/*?:"<>|]', "_", title)[:80]
    out_template = str(DOWNLOADS_DIR / f"{safe_title}.%(ext)s")

    ytdlp = get_ytdlp()
    ffmpeg = get_ffmpeg()

    cmd = [
        ytdlp,
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "-f", format_id,
        "-o", out_template,
    ]

    # Add ffmpeg location — pass full path to the binary, not just the directory.
    # imageio-ffmpeg names the binary "ffmpeg-win-x86_64-v7.1.exe" which yt-dlp
    # won't find if we only pass the parent directory (it looks for "ffmpeg.exe").
    if ffmpeg and ffmpeg != "ffmpeg":
        cmd += ["--ffmpeg-location", ffmpeg]  # full path to exe

    # For audio-only, convert to mp3 if ffmpeg available
    if format_id == "bestaudio/best" and ffmpeg:
        cmd += ["-x", "--audio-format", "mp3"]
    else:
        cmd += ["--merge-output-format", "mp4"]

    cmd.append(url)

    async def event_stream():
        yield f"data: {json.dumps({'type': 'start'})}\n\n"

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

            async for line_bytes in proc.stdout:
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                # Parse standard yt-dlp progress: "[download]  45.2% of 12.34MiB at 1.23MiB/s ETA 00:05"
                dl_match = re.search(
                    r'\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\s*\w+)\s+at\s+([\d.]+\s*\w+/s)\s+ETA\s+([\d:]+)',
                    line
                )
                if dl_match:
                    percent = float(dl_match.group(1))
                    total = dl_match.group(2).strip()
                    speed = dl_match.group(3).strip()
                    eta = dl_match.group(4).strip()
                    yield f"data: {json.dumps({'type': 'progress', 'percent': percent, 'speed': speed, 'eta': eta, 'total': total})}\n\n"
                    continue

                # 100% done line: "[download] 100% of ..."
                done_match = re.search(r'\[download\]\s+100%\s+of\s+([\d.]+\s*\w+)', line)
                if done_match:
                    yield f"data: {json.dumps({'type': 'progress', 'percent': 100.0, 'speed': '', 'eta': '0:00', 'total': done_match.group(1).strip()})}\n\n"
                    continue

                # Log other lines (ffmpeg, merging, etc.)
                if any(line.startswith(p) for p in ("[download]", "[ffmpeg]", "[Merger]", "[ExtractAudio]", "Merging")):
                    yield f"data: {json.dumps({'type': 'log', 'message': line})}\n\n"

            await proc.wait()

            if proc.returncode == 0:
                saved_files = sorted(DOWNLOADS_DIR.glob(f"{safe_title}.*"), key=lambda f: f.stat().st_mtime, reverse=True)
                saved_path = str(saved_files[0]) if saved_files else str(DOWNLOADS_DIR)
                yield f"data: {json.dumps({'type': 'done', 'path': saved_path, 'folder': str(DOWNLOADS_DIR)})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Download failed. The site may require login, or try a different quality.'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn
    import os
    os.environ.setdefault("PYTHONUTF8", "1")
    ffmpeg = get_ffmpeg()
    print("AK Downloader backend starting...")
    print(f"Downloads dir: {DOWNLOADS_DIR}")
    print(f"ffmpeg: {'found at ' + ffmpeg if ffmpeg else 'NOT FOUND - only pre-merged formats will work'}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
