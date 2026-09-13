import { useState, useRef, useCallback } from 'react'
import {
  Download,
  Link,
  Clipboard,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FolderOpen,
  Sparkles,
} from 'lucide-react'
import { VideoCard } from './components/VideoCard'
import { ProgressBar } from './components/ProgressBar'
import { QualitySelector } from './components/QualitySelector'
import type { VideoInfo, DownloadState, DownloadProgress } from './types'

const SUPPORTED_SITES = [
  'YouTube', 'TikTok', 'Instagram', 'Twitter/X', 'Facebook',
  'Vimeo', 'Reddit', 'Dailymotion', 'Twitch', '& 1800+ more',
]

function Toast({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) {
  const colors = {
    success: 'bg-green-500/20 border-green-500/50 text-green-300',
    error: 'bg-red-500/20 border-red-500/50 text-red-300',
    info: 'bg-brand/20 border-brand/50 text-brand-light',
  }
  const icons = {
    success: <CheckCircle2 size={16} />,
    error: <AlertCircle size={16} />,
    info: <Sparkles size={16} />,
  }
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${colors[type]}`}>
      {icons[type]}
      {message}
    </div>
  )
}

export default function App() {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<DownloadState>('idle')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [selectedFormat, setSelectedFormat] = useState('')
  const [progress, setProgress] = useState<DownloadProgress>({ percent: 0, speed: '', eta: '', total: '' })
  const [errorMsg, setErrorMsg] = useState('')
  const [savedPath, setSavedPath] = useState('')
  const [logLines, setLogLines] = useState<string[]>([])
  const esRef = useRef<EventSource | null>(null)

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text.trim())
    } catch {
      // ignore
    }
  }

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return
    setErrorMsg('')
    setVideoInfo(null)
    setSavedPath('')
    setLogLines([])
    setState('fetching')

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to fetch video info')
      }
      setVideoInfo(data)
      // Default: first format
      if (data.formats?.length) setSelectedFormat(data.formats[0].id)
      setState('ready')
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
      setState('error')
    }
  }, [url])

  const handleDownload = useCallback(() => {
    if (!videoInfo || !selectedFormat) return
    if (esRef.current) esRef.current.close()

    setState('downloading')
    setSavedPath('')
    setLogLines([])
    setProgress({ percent: 0, speed: '', eta: '', total: '' })

    const params = new URLSearchParams({
      url: url.trim(),
      format_id: selectedFormat,
      title: videoInfo.title,
    })

    const es = new EventSource(`/api/download?${params}`)
    esRef.current = es

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'progress') {
          setProgress({
            percent: msg.percent,
            speed: msg.speed,
            eta: msg.eta,
            total: msg.total,
          })
        } else if (msg.type === 'log') {
          setLogLines((prev) => [...prev.slice(-20), msg.message])
        } else if (msg.type === 'done') {
          setProgress((p) => ({ ...p, percent: 100 }))
          setSavedPath(msg.folder)
          setState('done')
          es.close()
        } else if (msg.type === 'error') {
          setErrorMsg(msg.message)
          setState('error')
          es.close()
        }
      } catch { /* ignore */ }
    }

    es.onerror = () => {
      if (state !== 'done') {
        setErrorMsg('Connection to backend lost. Is the server running?')
        setState('error')
      }
      es.close()
    }
  }, [videoInfo, selectedFormat, url, state])

  const handleReset = () => {
    if (esRef.current) esRef.current.close()
    setState('idle')
    setUrl('')
    setVideoInfo(null)
    setSelectedFormat('')
    setProgress({ percent: 0, speed: '', eta: '', total: '' })
    setErrorMsg('')
    setSavedPath('')
    setLogLines([])
  }

  const isLoading = state === 'fetching' || state === 'downloading'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
            <Download size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">AK Downloader</span>
        </div>
        <span className="text-xs text-gray-600 hidden sm:block">
          Powered by yt-dlp · 1800+ sites
        </span>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-6">

          {/* Hero text */}
          {state === 'idle' && (
            <div className="text-center space-y-3">
              <h1 className="text-4xl font-extrabold text-white tracking-tight">
                Download Any Video
              </h1>
              <p className="text-gray-400 text-sm">
                Paste a URL from YouTube, TikTok, Instagram, Twitter/X and more
              </p>
              {/* Supported sites */}
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {SUPPORTED_SITES.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-3 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* URL input */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-gray-900 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-brand transition-colors">
                <Link size={16} className="text-gray-500 flex-shrink-0" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleFetch()}
                  placeholder="Paste video URL here..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
                  disabled={isLoading}
                />
                {url && (
                  <button
                    onClick={() => setUrl('')}
                    className="text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Paste button */}
              <button
                onClick={handlePaste}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-gray-800 border border-white/10 text-gray-400 hover:text-white hover:border-white/25 transition-all disabled:opacity-50"
                title="Paste from clipboard"
              >
                <Clipboard size={16} />
              </button>
            </div>

            {/* Fetch button */}
            <button
              onClick={handleFetch}
              disabled={!url.trim() || isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
                bg-brand hover:bg-brand-dark text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {state === 'fetching' ? (
                <><Loader2 size={16} className="animate-spin" /> Fetching info...</>
              ) : (
                <><Sparkles size={16} /> Get Video Info</>
              )}
            </button>
          </div>

          {/* Error toast */}
          {state === 'error' && errorMsg && (
            <Toast message={errorMsg} type="error" />
          )}

          {/* Video card */}
          {videoInfo && state !== 'idle' && (
            <VideoCard info={videoInfo} />
          )}

          {/* ffmpeg warning */}
          {videoInfo && !videoInfo.ffmpeg_available && (state === 'ready' || state === 'downloading') && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-yellow-300 text-xs">
              <span className="text-base flex-shrink-0">⚠️</span>
              <span>
                <strong>ffmpeg not found.</strong> Only pre-merged formats are shown. For higher quality options,{' '}
                <a href="https://ffmpeg.org/download.html" target="_blank" rel="noopener noreferrer"
                  className="underline hover:text-yellow-200">install ffmpeg</a>{' '}
                and restart the backend.
              </span>
            </div>
          )}

          {/* Quality selector */}
          {videoInfo && (state === 'ready' || state === 'downloading' || state === 'done') && (
            <QualitySelector
              formats={videoInfo.formats}
              selected={selectedFormat}
              onChange={setSelectedFormat}
              disabled={state === 'downloading'}
            />
          )}

          {/* Download button */}
          {videoInfo && state === 'ready' && (
            <button
              onClick={handleDownload}
              disabled={!selectedFormat}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all
                bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-indigo-800
                text-white shadow-lg shadow-brand/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={20} /> Download Now
            </button>
          )}

          {/* Progress */}
          {(state === 'downloading' || state === 'done') && (
            <ProgressBar progress={progress} done={state === 'done'} />
          )}

          {/* Log lines (collapsible) */}
          {logLines.length > 0 && (
            <div className="glass rounded-xl p-3 max-h-32 overflow-y-auto">
              {logLines.map((line, i) => (
                <p key={i} className="text-xs text-gray-500 font-mono leading-5">{line}</p>
              ))}
            </div>
          )}

          {/* Done banner */}
          {state === 'done' && savedPath && (
            <div className="glass rounded-2xl p-4 border border-green-500/30 bg-green-500/5">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-green-300 font-semibold text-sm">Download complete!</p>
                  <p className="text-gray-400 text-xs mt-1 flex items-center gap-1.5 break-all">
                    <FolderOpen size={12} className="flex-shrink-0" />
                    {savedPath}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="mt-3 w-full py-2 rounded-xl text-sm font-medium border border-white/10 text-gray-300 hover:bg-white/5 transition-all"
              >
                Download another video
              </button>
            </div>
          )}

          {/* Reset button when in error */}
          {state === 'error' && (
            <button
              onClick={handleReset}
              className="w-full py-2.5 rounded-xl text-sm font-medium border border-white/10 text-gray-400 hover:bg-white/5 transition-all"
            >
              Try again
            </button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-700">
        AK Downloader · For personal use only · Respect content creators
      </footer>
    </div>
  )
}
