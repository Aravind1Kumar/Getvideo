import { CompressionOption } from '../types'

export const COMPRESSION_PRESETS: CompressionOption[] = [
  {
    id: 'small',
    title: 'Small File (Easy Share)',
    badge: 'Save ~75%',
    description: '720p max, high efficiency. Perfect for WhatsApp, Discord & fast sharing.',
    reduction: '~70-80% smaller',
    icon: '🐼',
  },
  {
    id: 'medium',
    title: 'Medium Quality',
    badge: 'Save ~55%',
    description: '1080p max, sharp details. Balanced everyday storage and social uploads.',
    reduction: '~50-60% smaller',
    icon: '🎬',
  },
  {
    id: 'high',
    title: 'Just Compress (Best Quality)',
    badge: 'Save ~35%',
    description: 'Keeps original resolution. Smooth re-encoding without visible loss.',
    reduction: '~30-40% smaller',
    icon: '💎',
  },
  {
    id: 'whatsapp_16mb',
    title: 'Fit to WhatsApp (< 16 MB)',
    badge: 'Target 16MB',
    description: 'Calculates exact bitrate so video never exceeds WhatsApp attachment limits.',
    reduction: '< 16 MB',
    icon: '📱',
  },
  {
    id: 'email_25mb',
    title: 'Fit to Email (< 25 MB)',
    badge: 'Target 25MB',
    description: 'Guarantees the file stays under the 25 MB Gmail / Outlook limit.',
    reduction: '< 25 MB',
    icon: '📧',
  },
]

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}
