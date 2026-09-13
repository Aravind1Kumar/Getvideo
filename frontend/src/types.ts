export interface VideoFormat {
  id: string
  label: string
  height: number
  ext: string
  filesize: number | null
  type: 'video' | 'audio'
  needs_ffmpeg?: boolean
}

export interface VideoInfo {
  title: string
  thumbnail: string
  duration: number
  uploader: string
  view_count: number | null
  like_count: number | null
  description: string
  webpage_url: string
  extractor: string
  formats: VideoFormat[]
  ffmpeg_available: boolean
}

export type DownloadState = 'idle' | 'fetching' | 'ready' | 'downloading' | 'compressing' | 'done' | 'error'

export interface DownloadProgress {
  percent: number
  speed: string
  eta: string
  total: string
  stage?: 'downloading' | 'compressing'
}

export type CompressionPreset = 'none' | 'small' | 'medium' | 'high' | 'whatsapp_16mb' | 'email_25mb'

export interface CompressionOption {
  id: CompressionPreset
  title: string
  badge: string
  description: string
  reduction: string
  icon: string
}

export interface CompressUploadResponse {
  id: string
  filename: string
  size: number
  duration: number
  stored_filename: string
}

export interface CompressResult {
  filename: string
  path: string
  original_size: number
  compressed_size: number
  saved_percent: number
}
