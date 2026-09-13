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
  TrendingDown,
} from 'lucide-react'
import { VideoCard } from './components/VideoCard'
import { ProgressBar } from './components/ProgressBar'
import { QualitySelector } from './components/QualitySelector'
import { CompressTab } from './components/CompressTab'
import { formatFileSize } from './constants/presets'
import type { VideoInfo, DownloadState, DownloadProgress, CompressionPreset } from './types'

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
  const [activeTab, setActiveTab] = useState<'downloader' | 'compressor'>('downloader')
  const [url, setUrl] = useState('')
  const [state, setState] = useState<DownloadState>('idle')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [selectedFormat, setSelectedFormat] = useState('')
  const [compressPreset, setCompressPreset] = useState<CompressionPreset>('none')
  const [progress, setProgress] = useState<DownloadProgress>({ percent: 0, speed: '', eta: '', total: '' })
  const [stageMessage, setStageMessage] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState('')
  const [savedPath, setSavedPath] = useState('')
  const [savedFilename, setSavedFilename] = useState('')
  const [savedStats, setSavedStats] = useState<{ orig: number; comp: number | null; saved: number | null } | null>(null)
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
    setSavedFilename('')
    setSavedStats(null)
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
    setSavedFilename('')
    setSavedStats(null)
    setLogLines([])
    setStageMessage('')
    setProgress({ percent: 0, speed: '', eta: '', total: '', stage: 'downloading' })

    const params = new URLSearchParams({
      url: url.trim(),
      format_id: selectedFormat,
      title: videoInfo.title,
      compress_preset: compressPreset,
    })

    const es = new EventSource(`/api/download?${params}`)
    esRef.current = es

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'stage') {
          if (msg.stage === 'compressing') {
            setState('compressing')
            setStageMessage(msg.message || 'Panda Compress is optimizing your video...')
            setProgress((p) => ({ ...p, percent: 0, stage: 'compressing' }))
          }
        } else if (msg.type === 'progress') {
          setProgress({
            percent: msg.percent,
            speed: msg.speed,
            eta: msg.eta,
            total: msg.total,
            stage: msg.stage,
          })
        } else if (msg.type === 'log') {
          setLogLines((prev) => [...prev.slice(-20), msg.message])
        } else if (msg.type === 'done') {
          setProgress((p) => ({ ...p, percent: 100 }))
          setSavedPath(msg.folder)
          setSavedFilename(msg.filename || '')
          if (msg.original_size) {
            setSavedStats({
              orig: msg.original_size,
              comp: msg.compressed_size,
              saved: msg.saved_percent,
            })
          }
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
  }, [videoInfo, selectedFormat, url, state, compressPreset])

  const handleReset = () => {
    if (esRef.current) esRef.current.close()
    setState('idle')
    setUrl('')
    setVideoInfo(null)
    setSelectedFormat('')
    setCompressPreset('none')
    setProgress({ percent: 0, speed: '', eta: '', total: '' })
    setErrorMsg('')
    setSavedPath('')
    setSavedFilename('')
    setSavedStats(null)
    setLogLines([])
    setStageMessage('')
  }

  const isLoading = state === 'fetching' || state === 'downloading' || state === 'compressing'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shadow-md shadow-brand/20">
            <Download size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">AK Downloader</span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('downloader')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'downloader'
                ? 'bg-brand text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>📥</span> Downloader
          </button>
          <button
            onClick={() => setActiveTab('compressor')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'compressor'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>🐼</span> Panda Compress
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-8 sm:py-12">
        {activeTab === 'compressor' ? (
          <CompressTab />
        ) : (
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

                <button
                  onClick={handlePaste}
                  disabled={isLoading}
                  className="p-2.5 rounded-xl bg-gray-800 border border-white/10 text-gray-400 hover:text-white hover:border-white/25 transition-all disabled:opacity-50"
                  title="Paste from clipboard"
                >
                  <Clipboard size={16} />
                </button>
              </div>

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

            {/* Quality & Panda Compression selector */}
            {videoInfo && (state === 'ready' || state === 'downloading' || state === 'compressing' || state === 'done') && (
              <QualitySelector
                formats={videoInfo.formats}
                selected={selectedFormat}
                onChange={setSelectedFormat}
                disabled={state === 'downloading' || state === 'compressing'}
                compressPreset={compressPreset}
                onCompressPresetChange={setCompressPreset}
                ffmpegAvailable={videoInfo.ffmpeg_available}
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
                <Download size={20} />
                {compressPreset !== 'none' ? 'Download & Panda Compress' : 'Download Now'}
              </button>
            )}

            {/* Stage Indicator during post-download compression */}
            {state === 'compressing' && (
              <div className="glass rounded-xl p-3.5 border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2.5 text-emerald-300 text-xs">
                <Loader2 size={15} className="animate-spin text-emerald-400" />
                <span>{stageMessage || 'Panda Compress is re-encoding the video...'}</span>
              </div>
            )}

            {/* Progress Bar */}
            {(state === 'downloading' || state === 'compressing' || state === 'done') && (
              <ProgressBar progress={progress} done={state === 'done'} />
            )}

            {/* Log lines */}
            {logLines.length > 0 && (
              <div className="glass rounded-xl p-3 max-h-32 overflow-y-auto">
                {logLines.map((line, i) => (
                  <p key={i} className="text-xs text-gray-500 font-mono leading-5">{line}</p>
                ))}
              </div>
            )}

            {/* Done banner */}
            {state === 'done' && (
              <div className="glass rounded-2xl p-5 border border-green-500/30 bg-green-500/5 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={22} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-green-300 font-bold text-sm">Download complete!</p>
                    {savedPath && (
                      <p className="text-gray-400 text-xs mt-1 flex items-center gap-1.5 break-all">
                        <FolderOpen size={12} className="flex-shrink-0" />
                        {savedPath}
                      </p>
                    )}
                  </div>
                </div>

                {/* Compression stats if applied */}
                {savedStats && savedStats.comp && (
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-black/40 text-center border border-white/5">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500">Original</p>
                      <p className="text-xs font-bold text-gray-300 mt-0.5">
                        {formatFileSize(savedStats.orig)}
                      </p>
                    </div>
                    <div className="border-x border-white/10">
                      <p className="text-[10px] uppercase font-bold text-gray-500">Panda Compressed</p>
                      <p className="text-xs font-bold text-emerald-400 mt-0.5">
                        {formatFileSize(savedStats.comp)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-emerald-500">Saved</p>
                      <p className="text-xs font-extrabold text-emerald-300 mt-0.5 flex items-center justify-center gap-0.5">
                        <TrendingDown size={12} />
                        {savedStats.saved}%
                      </p>
                    </div>
                  </div>
                )}

                {/* Direct download link for browser/mobile */}
                {savedFilename && (
                  <a
                    href={`/api/file/download/${encodeURIComponent(savedFilename)}`}
                    download={savedFilename}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-md shadow-emerald-500/20"
                  >
                    <Download size={16} /> Save File to Device
                  </a>
                )}

                <button
                  onClick={handleReset}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border border-white/10 text-gray-300 hover:bg-white/5 transition-all"
                >
                  Download another video
                </button>
              </div>
            )}

            {/* Try again button on error */}
            {state === 'error' && (
              <button
                onClick={handleReset}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-white/10 text-gray-400 hover:bg-white/5 transition-all"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-600">
        AK Downloader & Panda Compressor · Built with React & FFmpeg
      </footer>
    </div>
  )
}
