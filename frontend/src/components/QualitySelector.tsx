import { VideoFormat } from '../types'
import { Video, Music } from 'lucide-react'

interface Props {
  formats: VideoFormat[]
  selected: string
  onChange: (id: string) => void
  disabled?: boolean
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

export function QualitySelector({ formats, selected, onChange, disabled }: Props) {
  return (
    <div className="glass rounded-2xl p-4 space-y-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Select Quality
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
                ${isSelected
                  ? 'border-brand bg-brand/15 text-white'
                  : 'border-white/10 bg-white/3 text-gray-300 hover:border-white/25 hover:bg-white/5'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Icon */}
              <span className={`flex-shrink-0 ${colorClass}`}>
                {fmt.type === 'audio' ? <Music size={16} /> : <Video size={16} />}
              </span>

              {/* Label */}
              <span className="flex-1 text-sm font-medium">
                {fmt.label}
                <span className="text-gray-500 font-normal text-xs">
                  {formatFilesize(fmt.filesize)}
                </span>
              </span>

              {/* Selected indicator */}
              {isSelected && (
                <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
