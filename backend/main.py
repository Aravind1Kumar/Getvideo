import os
import re
import json
import uuid
import asyncio
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

app = FastAPI(title="AK Downloader & Panda Compressor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOADS_DIR = Path.home() / "Downloads" / "AKDownloader"
UPLOADS_DIR = DOWNLOADS_DIR / "uploads"
COMPRESSED_DIR = DOWNLOADS_DIR / "compressed"

DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
COMPRESSED_DIR.mkdir(parents=True, exist_ok=True)

YTDLP_PATH = r"C:\Users\lenovo\.conda\envs\PythonProject\Scripts\yt-dlp.exe"


def get_ytdlp() -> str:
    if Path(YTDLP_PATH).exists():
        return YTDLP_PATH
    for candidate in ["yt-dlp", "yt-dlp.exe"]:
        try:
            subprocess.run([candidate, "--version"], capture_output=True, timeout=5)
            return candidate
        except Exception:
            pass
    raise RuntimeError("yt-dlp not found")


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


def get_video_duration(ffmpeg: str, filepath: str) -> float:
    """Inspect duration of video using ffmpeg."""
    try:
        r = subprocess.run([ffmpeg, "-i", filepath], capture_output=True, text=True, errors="replace", timeout=10)
        m = re.search(r'Duration:\s*(\d+):(\d+):([\d.]+)', r.stderr)
        if m:
            hours = float(m.group(1))
            minutes = float(m.group(2))
            seconds = float(m.group(3))
            return hours * 3600 + minutes * 60 + seconds
    except Exception:
        pass
    return 0.0


def build_compress_cmd(ffmpeg: str, input_path: str, output_path: str, preset: str, duration: float) -> list[str]:
    """
    Build FFmpeg command based on Panda Compressor presets:
    - small: Max compression (CRF 28, max 720p, 96k audio) -> ~75% smaller
    - medium: Balanced (CRF 24, max 1080p, 128k audio) -> ~50-60% smaller
    - high: Best quality (CRF 21, original resolution, 160k audio) -> ~30-45% smaller
    - whatsapp_16mb: Fits under 16MB via calculated target bitrate
    - email_25mb: Fits under 25MB via calculated target bitrate
    """
    cmd = [ffmpeg, "-y", "-i", input_path]

    if preset == "small":
        cmd += [
            "-c:v", "libx264",
            "-crf", "28",
            "-preset", "faster",
            "-vf", "scale='min(1280,iw)':-2",
            "-c:a", "aac",
            "-b:a", "96k",
            "-movflags", "+faststart",
        ]
    elif preset == "medium":
        cmd += [
            "-c:v", "libx264",
            "-crf", "24",
            "-preset", "fast",
            "-vf", "scale='min(1920,iw)':-2",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
        ]
    elif preset == "high":
        cmd += [
            "-c:v", "libx264",
            "-crf", "21",
            "-preset", "medium",
            "-c:a", "aac",
            "-b:a", "160k",
            "-movflags", "+faststart",
        ]
    elif preset in ("whatsapp_16mb", "email_25mb"):
        target_mb = 15.0 if preset == "whatsapp_16mb" else 24.0
        dur = duration if duration > 1.0 else 60.0
        # Total bits = target_mb * 8 * 1024 * 1024
        audio_kbps = 96 if preset == "whatsapp_16mb" else 128
        total_kbps = (target_mb * 8192) / dur
        video_kbps = max(150, int(total_kbps - audio_kbps))

        cmd += [
            "-c:v", "libx264",
            "-b:v", f"{video_kbps}k",
            "-maxrate", f"{int(video_kbps * 1.3)}k",
            "-bufsize", f"{int(video_kbps * 2.0)}k",
            "-preset", "fast",
            "-vf", "scale='min(1280,iw)':-2",
            "-c:a", "aac",
            "-b:a", f"{audio_kbps}k",
            "-movflags", "+faststart",
        ]
    else:
        # Default medium
        cmd += [
            "-c:v", "libx264",
            "-crf", "24",
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
        ]

    cmd += ["-progress", "pipe:1", output_path]
    return cmd


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

            formats = native_formats[:8] if native_formats else [{
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
async def download_video(url: str, format_id: str, title: str = "video", compress_preset: str = "none"):
    """Stream download with real-time SSE progress and optional Panda compression."""
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

    if ffmpeg and ffmpeg != "ffmpeg":
        cmd += ["--ffmpeg-location", ffmpeg]

    if format_id == "bestaudio/best" and ffmpeg:
        cmd += ["-x", "--audio-format", "mp3"]
    else:
        cmd += ["--merge-output-format", "mp4"]

    cmd.append(url)

    async def event_stream():
        yield f"data: {json.dumps({'type': 'start', 'stage': 'downloading'})}\n\n"

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

                dl_match = re.search(
                    r'\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\s*\w+)\s+at\s+([\d.]+\s*\w+/s)\s+ETA\s+([\d:]+)',
                    line
                )
                if dl_match:
                    percent = float(dl_match.group(1))
                    total = dl_match.group(2).strip()
                    speed = dl_match.group(3).strip()
                    eta = dl_match.group(4).strip()
                    yield f"data: {json.dumps({'type': 'progress', 'percent': percent, 'speed': speed, 'eta': eta, 'total': total, 'stage': 'downloading'})}\n\n"
                    continue

                done_match = re.search(r'\[download\]\s+100%\s+of\s+([\d.]+\s*\w+)', line)
                if done_match:
                    yield f"data: {json.dumps({'type': 'progress', 'percent': 100.0, 'speed': '', 'eta': '0:00', 'total': done_match.group(1).strip(), 'stage': 'downloading'})}\n\n"
                    continue

                if any(line.startswith(p) for p in ("[download]", "[ffmpeg]", "[Merger]", "[ExtractAudio]", "Merging")):
                    yield f"data: {json.dumps({'type': 'log', 'message': line})}\n\n"

            await proc.wait()

            if proc.returncode != 0:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Download failed. The site may require login, or try a different quality.'})}\n\n"
                return

            saved_files = sorted(DOWNLOADS_DIR.glob(f"{safe_title}.*"), key=lambda f: f.stat().st_mtime, reverse=True)
            if not saved_files:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Downloaded file not found.'})}\n\n"
                return

            downloaded_file = saved_files[0]
            orig_size = downloaded_file.stat().st_size

            # Optional Panda Compression pipeline
            if compress_preset and compress_preset != "none" and ffmpeg and downloaded_file.suffix.lower() in (".mp4", ".mkv", ".webm", ".mov"):
                yield f"data: {json.dumps({'type': 'stage', 'stage': 'compressing', 'message': 'Panda Compress is optimizing your video...'})}\n\n"

                compressed_output = COMPRESSED_DIR / f"{safe_title}_compressed.mp4"
                dur = get_video_duration(ffmpeg, str(downloaded_file))
                compress_cmd = build_compress_cmd(ffmpeg, str(downloaded_file), str(compressed_output), compress_preset, dur)

                comp_proc = await asyncio.create_subprocess_exec(
                    *compress_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                # Track FFmpeg progress via stdout
                async for c_line_bytes in comp_proc.stdout:
                    c_line = c_line_bytes.decode("utf-8", errors="replace").strip()
                    if c_line.startswith("out_time_ms="):
                        try:
                            out_time_us = float(c_line.split("=")[1])
                            curr_sec = out_time_us / 1_000_000.0
                            pct = min(99.0, (curr_sec / dur) * 100.0) if dur > 0 else 50.0
                            yield f"data: {json.dumps({'type': 'progress', 'percent': round(pct, 1), 'speed': 'compressing', 'eta': '', 'total': '', 'stage': 'compressing'})}\n\n"
                        except Exception:
                            pass

                await comp_proc.wait()

                if comp_proc.returncode == 0 and compressed_output.exists():
                    comp_size = compressed_output.stat().st_size
                    saved_pct = round((1.0 - (comp_size / orig_size)) * 100.0, 1) if orig_size > 0 else 0.0
                    filename = compressed_output.name
                    yield f"data: {json.dumps({'type': 'done', 'path': str(compressed_output), 'folder': str(COMPRESSED_DIR), 'filename': filename, 'original_size': orig_size, 'compressed_size': comp_size, 'saved_percent': saved_pct})}\n\n"
                    return

            # Normal done (without compression)
            filename = downloaded_file.name
            yield f"data: {json.dumps({'type': 'done', 'path': str(downloaded_file), 'folder': str(DOWNLOADS_DIR), 'filename': filename, 'original_size': orig_size, 'compressed_size': None, 'saved_percent': None})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/compress/upload")
async def upload_for_compression(file: UploadFile = File(...)):
    """Upload a local video file to compress with Panda Compressor."""
    file_id = str(uuid.uuid4())[:8]
    clean_name = re.sub(r'[\\/*?:"<>|]', "_", file.filename or "video.mp4")
    upload_path = UPLOADS_DIR / f"{file_id}_{clean_name}"

    try:
        contents = await file.read()
        with open(upload_path, "wb") as f:
            f.write(contents)

        ffmpeg = get_ffmpeg()
        dur = get_video_duration(ffmpeg, str(upload_path)) if ffmpeg else 0.0
        file_size = upload_path.stat().st_size

        return {
            "id": file_id,
            "filename": clean_name,
            "size": file_size,
            "duration": dur,
            "stored_filename": f"{file_id}_{clean_name}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@app.get("/api/compress/process")
async def process_compression(file_id: str, stored_filename: str, preset: str = "medium"):
    """Compress an uploaded file using Panda-style FFmpeg settings with SSE progress."""
    input_path = UPLOADS_DIR / stored_filename
    if not input_path.exists():
        raise HTTPException(status_code=404, detail="Uploaded file not found")

    ffmpeg = get_ffmpeg()
    if not ffmpeg:
        raise HTTPException(status_code=500, detail="FFmpeg is required for video compression")

    stem = Path(stored_filename).stem
    out_filename = f"{stem}_panda_{preset}.mp4"
    output_path = COMPRESSED_DIR / out_filename
    dur = get_video_duration(ffmpeg, str(input_path))
    cmd = build_compress_cmd(ffmpeg, str(input_path), str(output_path), preset, dur)

    async def event_stream():
        yield f"data: {json.dumps({'type': 'start', 'stage': 'compressing'})}\n\n"
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            async for line_bytes in proc.stdout:
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if line.startswith("out_time_ms="):
                    try:
                        out_time_us = float(line.split("=")[1])
                        curr_sec = out_time_us / 1_000_000.0
                        pct = min(99.0, (curr_sec / dur) * 100.0) if dur > 0 else 50.0
                        yield f"data: {json.dumps({'type': 'progress', 'percent': round(pct, 1), 'stage': 'compressing'})}\n\n"
                    except Exception:
                        pass

            await proc.wait()

            if proc.returncode == 0 and output_path.exists():
                orig_size = input_path.stat().st_size
                comp_size = output_path.stat().st_size
                saved_pct = round((1.0 - (comp_size / orig_size)) * 100.0, 1) if orig_size > 0 else 0.0
                yield f"data: {json.dumps({'type': 'done', 'path': str(output_path), 'filename': out_filename, 'original_size': orig_size, 'compressed_size': comp_size, 'saved_percent': saved_pct})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Compression failed.'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/file/download/{filename}")
def download_file(filename: str):
    """Direct file download endpoint for browser download."""
    clean_filename = Path(filename).name

    # Check compressed, downloads, or uploads
    for folder in [COMPRESSED_DIR, DOWNLOADS_DIR, UPLOADS_DIR]:
        target = folder / clean_filename
        if target.exists():
            return FileResponse(
                path=str(target),
                media_type="application/octet-stream",
                filename=clean_filename,
            )

    raise HTTPException(status_code=404, detail="File not found")


if __name__ == "__main__":
    import uvicorn
    os.environ.setdefault("PYTHONUTF8", "1")
    ffmpeg = get_ffmpeg()
    print("AK Downloader & Panda Compressor backend starting...")
    print(f"Downloads dir: {DOWNLOADS_DIR}")
    print(f"Compressed dir: {COMPRESSED_DIR}")
    print(f"ffmpeg: {'found at ' + ffmpeg if ffmpeg else 'NOT FOUND'}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
