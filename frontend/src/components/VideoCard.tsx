import { VideoInfo } from '../types'
import { Clock, Eye, Heart, ExternalLink } from 'lucide-react'

interface Props {
  info: VideoInfo
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatCount(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function VideoCard({ info }: Props) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 w-full sm:w-48 h-32 sm:h-28 rounded-xl overflow-hidden bg-gray-800">
          {info.thumbnail ? (
            <img
              src={info.thumbnail}
              alt={info.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <span className="text-4xl">🎬</span>
            </div>
          )}
          {/* Duration badge */}
          {info.duration > 0 && (
            <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <Clock size={10} />
              {formatDuration(info.duration)}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col gap-2 min-w-0">
          {/* Source badge */}
          {info.extractor && (
            <span className="text-xs bg-brand/20 text-brand-light px-2 py-0.5 rounded-full w-fit font-medium uppercase tracking-wide">
              {info.extractor}
            </span>
          )}

          {/* Title */}
          <h2 className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {info.title}
          </h2>

          {/* Uploader */}
          <p className="text-xs text-gray-400">{info.uploader}</p>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {info.view_count !== null && (
              <span className="flex items-center gap-1">
                <Eye size={11} /> {formatCount(info.view_count)}
              </span>
            )}
            {info.like_count !== null && (
              <span className="flex items-center gap-1">
                <Heart size={11} /> {formatCount(info.like_count)}
              </span>
            )}
            <a
              href={info.webpage_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-brand-light transition-colors ml-auto"
            >
              <ExternalLink size={11} /> Open
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
