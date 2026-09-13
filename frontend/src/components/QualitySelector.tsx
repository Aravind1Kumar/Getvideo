import { VideoFormat, CompressionPreset } from '../types'
import { Video, Music, Sparkles } from 'lucide-react'
import { COMPRESSION_PRESETS } from '../constants/presets'

interface Props {
  formats: VideoFormat[]
  selected: string
  onChange: (id: string) => void
  disabled?: boolean
  compressPreset: CompressionPreset
  onCompressPresetChange: (p: CompressionPreset) => void
  ffmpegAvailable?: boolean
}

function formatFilesize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes > 1_000_000_000) return ` · ${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes > 1_000_000) return ` · ${(bytes / 1_000_000).toFixed(0)} MB`
  return ` · ${(bytes / 1_000).toFixed(0)} KB`
}

const QUALITY_COLORS: Record<string, string> = {
  '2160': 'text-purple-400',
  '1440': 'text-blue-400',
  '1080': 'text-cyan-400',
  '720': 'text-green-400',
  '480': 'text-yellow-400',
  '360': 'text-orange-400',
  '240': 'text-red-400',
  '0': 'text-pink-400',
}

export function QualitySelector({
  formats,
  selected,
  onChange,
  disabled,
  compressPreset,
  onCompressPresetChange,
  ffmpegAvailable = true,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Video Quality Selection */}
      <div className="glass rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Select Resolution
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {formats.map((fmt) => {
            const isSelected = selected === fmt.id
            const colorClass = QUALITY_COLORS[String(fmt.height)] ?? 'text-gray-300'

            return (
              <button
                key={fmt.id}
                onClick={() => onChange(fmt.id)}
                disabled={disabled}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                  ${
                    isSelected
                      ? 'border-brand bg-brand/15 text-white shadow-sm shadow-brand/10'
                      : 'border-white/10 bg-white/3 text-gray-300 hover:border-white/25 hover:bg-white/5'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span className={`flex-shrink-0 ${colorClass}`}>
                  {fmt.type === 'audio' ? <Music size={16} /> : <Video size={16} />}
                </span>

                <span className="flex-1 text-sm font-medium truncate">
                  {fmt.label}
                  <span className="text-gray-500 font-normal text-xs">
                    {formatFilesize(fmt.filesize)}
                  </span>
                </span>

                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Optional Panda Compressor for Download */}
      {ffmpegAvailable && (
        <div className="glass rounded-2xl p-4 space-y-2.5 border border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🐼</span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Panda Video Compression
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-medium">Optional</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <button
              onClick={() => onCompressPresetChange('none')}
              disabled={disabled}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                compressPreset === 'none'
                  ? 'border-emerald-500 bg-emerald-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              ⚡ Original
              <span className="block text-[10px] font-normal text-gray-400 mt-0.5">No compression</span>
            </button>

            {COMPRESSION_PRESETS.slice(0, 4).map((cp) => (
              <button
                key={cp.id}
                onClick={() => onCompressPresetChange(cp.id)}
                disabled={disabled}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left truncate ${
                  compressPreset === cp.id
                    ? 'border-emerald-500 bg-emerald-500/20 text-white shadow-sm'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <span className="truncate block">{cp.icon} {cp.title.split(' ')[0]}</span>
                <span className="block text-[10px] font-normal text-emerald-400 mt-0.5">{cp.badge}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
