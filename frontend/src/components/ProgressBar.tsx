import { DownloadProgress } from '../types'
import { Zap, Timer } from 'lucide-react'

interface Props {
  progress: DownloadProgress
  done?: boolean
}

export function ProgressBar({ progress, done }: Props) {
  const pct = Math.min(100, Math.max(0, progress.percent))

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      {/* Bar */}
      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: done
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : 'linear-gradient(90deg, #6366f1, #818cf8)',
          }}
        />
        {/* Shimmer */}
        {!done && pct > 0 && pct < 100 && (
          <div
            className="absolute inset-y-0 rounded-full opacity-40"
            style={{
              width: `${pct}%`,
              background:
                'linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.4) 80%, transparent 100%)',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="text-white font-bold text-sm">{pct.toFixed(1)}%</span>

        <div className="flex items-center gap-4">
          {progress.total && progress.total !== 'N/A' && (
            <span className="text-gray-500">{progress.total}</span>
          )}
          {progress.speed && progress.speed !== 'N/A' && (
            <span className="flex items-center gap-1 text-brand-light">
              <Zap size={11} /> {progress.speed}
            </span>
          )}
          {progress.eta && progress.eta !== 'N/A' && !done && (
            <span className="flex items-center gap-1">
              <Timer size={11} /> {progress.eta}
            </span>
          )}
          {done && <span className="text-green-400 font-medium">Done ✓</span>}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}
