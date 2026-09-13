import { useState, useRef, ChangeEvent, DragEvent } from 'react'
import {
  UploadCloud,
  FileVideo,
  Sparkles,
  CheckCircle2,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
  TrendingDown,
  FileCheck,
} from 'lucide-react'
import { COMPRESSION_PRESETS, formatFileSize } from '../constants/presets'
import { CompressionPreset, CompressUploadResponse, CompressResult } from '../types'

export function CompressTab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadData, setUploadData] = useState<CompressUploadResponse | null>(null)
  const [preset, setPreset] = useState<CompressionPreset>('small')
  const [status, setStatus] = useState<'idle' | 'uploading' | 'ready' | 'compressing' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [result, setResult] = useState<CompressResult | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|mkv|webm|avi|flv)$/i)) {
      setErrorMsg('Please select a valid video file (MP4, MOV, MKV, WEBM).')
      setStatus('error')
      return
    }
    setErrorMsg('')
    setSelectedFile(file)
    setUploadData(null)
    setResult(null)
    setStatus('ready')
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleStartCompression = async () => {
    if (!selectedFile) return
    setErrorMsg('')
    setStatus('uploading')
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const res = await fetch('/api/compress/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Upload failed')
      }

      const upData: CompressUploadResponse = await res.json()
      setUploadData(upData)
      setStatus('compressing')

      // Start SSE processing
      if (esRef.current) esRef.current.close()

      const params = new URLSearchParams({
        file_id: upData.id,
        stored_filename: upData.stored_filename,
        preset: preset,
      })

      const es = new EventSource(`/api/compress/process?${params}`)
      esRef.current = es

      es.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.type === 'progress') {
            setProgress(msg.percent)
          } else if (msg.type === 'done') {
            setProgress(100)
            setResult({
              filename: msg.filename,
              path: msg.path,
              original_size: msg.original_size,
              compressed_size: msg.compressed_size,
              saved_percent: msg.saved_percent,
            })
            setStatus('done')
            es.close()
          } else if (msg.type === 'error') {
            setErrorMsg(msg.message || 'Compression failed')
            setStatus('error')
            es.close()
          }
        } catch {
          // ignore parsing error
        }
      }

      es.onerror = () => {
        if (status !== 'done') {
          setErrorMsg('Lost connection during compression.')
          setStatus('error')
        }
        es.close()
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error starting compression')
      setStatus('error')
    }
  }

  const handleReset = () => {
    if (esRef.current) esRef.current.close()
    setSelectedFile(null)
    setUploadData(null)
    setPreset('small')
    setStatus('idle')
    setProgress(0)
    setErrorMsg('')
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <span>🐼</span> Panda Video Engine
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Smart Video Compressor</h2>
        <p className="text-gray-400 text-xs sm:text-sm">
          Reduce large video files by up to 80% without losing visible clarity.
        </p>
      </div>

      {/* Upload Box (when not compressing / done) */}
      {!selectedFile && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all
            flex flex-col items-center justify-center gap-4
            ${
              isDragging
                ? 'border-brand bg-brand/10 scale-[1.01]'
                : 'border-white/15 bg-white/5 hover:border-brand/50 hover:bg-white/[0.08]'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.mov,.mkv,.webm"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0])
              }
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-brand/15 text-brand-light flex items-center justify-center shadow-lg shadow-brand/10">
            <UploadCloud size={32} />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">Click or drag & drop video here</p>
            <p className="text-xs text-gray-500">Supports MP4, MOV, MKV, WEBM (up to 2GB)</p>
          </div>
        </div>
      )}

      {/* Selected File Card */}
      {selectedFile && status !== 'done' && (
        <div className="glass rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-brand/20 text-brand-light flex items-center justify-center flex-shrink-0">
              <FileVideo size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          {status !== 'uploading' && status !== 'compressing' && (
            <button
              onClick={handleReset}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
            >
              Change file
            </button>
          )}
        </div>
      )}

      {/* Error Message */}
      {status === 'error' && errorMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Preset Selector */}
      {selectedFile && (status === 'ready' || status === 'error') && (
        <div className="space-y-3">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
            Select Panda Compression Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {COMPRESSION_PRESETS.map((p) => {
              const isSelected = preset === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`
                    p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2
                    ${
                      isSelected
                        ? 'border-brand bg-brand/15 text-white shadow-md shadow-brand/10 ring-1 ring-brand'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:bg-white/[0.08]'
                    }
                  `}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-sm font-bold text-white">{p.title}</span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-brand text-white'
                          : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{p.description}</p>
                </button>
              )
            })}
          </div>

          <button
            onClick={handleStartCompression}
            className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all
              bg-gradient-to-r from-emerald-500 via-teal-500 to-brand hover:brightness-110
              text-white shadow-lg shadow-emerald-500/20"
          >
            <Sparkles size={18} /> Start Panda Compression
          </button>
        </div>
      )}

      {/* Progress Card during Uploading or Compressing */}
      {(status === 'uploading' || status === 'compressing') && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 size={18} className="animate-spin text-emerald-400" />
              <span className="text-sm font-semibold text-white">
                {status === 'uploading'
                  ? 'Uploading video...'
                  : 'Panda Compress is re-encoding frames...'}
              </span>
            </div>
            <span className="text-emerald-400 font-bold text-sm">{progress.toFixed(1)}%</span>
          </div>

          <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-400"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-xs text-gray-400 text-center">
            {status === 'uploading'
              ? 'Sending file to compression engine'
              : 'Applying H.264 high-efficiency compression algorithm...'}
          </p>
        </div>
      )}

      {/* Result Card */}
      {status === 'done' && result && (
        <div className="glass rounded-3xl p-6 sm:p-8 space-y-6 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Compression Complete!</h3>
              <p className="text-xs text-emerald-300">Ready to share anywhere without limits.</p>
            </div>
          </div>

          {/* Size Comparison Stats */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-black/40 border border-white/5 text-center">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Original</p>
              <p className="text-sm sm:text-base font-bold text-gray-300 mt-1">
                {formatFileSize(result.original_size)}
              </p>
            </div>
            <div className="border-x border-white/10">
              <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Compressed</p>
              <p className="text-sm sm:text-base font-bold text-emerald-400 mt-1">
                {formatFileSize(result.compressed_size)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-500">Saved</p>
              <p className="text-sm sm:text-base font-extrabold text-emerald-300 mt-1 flex items-center justify-center gap-0.5">
                <TrendingDown size={14} />
                {result.saved_percent}%
              </p>
            </div>
          </div>

          {/* Download Action Buttons */}
          <div className="space-y-2.5">
            <a
              href={`/api/file/download/${encodeURIComponent(result.filename)}`}
              download={result.filename}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all
                bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
            >
              <Download size={20} /> Download Compressed Video
            </a>

            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <RotateCcw size={15} /> Compress another video
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
