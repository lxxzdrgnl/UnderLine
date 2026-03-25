export interface SongMeta {
  id: string
  genius_id: string
  title: string
  artist: string
  image_url: string | null
  genius_path: string
  album: string | null
  album_image_url: string | null
  release_date: string | null
  description: string | null
  spotify_url: string | null
  youtube_url: string | null
  apple_music_url: string | null
  genius_artist_id: string | null
  genius_album_id: string | null
}

export interface LyricLineData {
  line_number: number
  original: string
  translation: string | null
  slang: string | null
  explanation: string | null
}

export interface GeniusSearchResult {
  genius_id: string
  title: string
  artist: string
  image_url: string | null
  genius_path: string
}

export interface GeniusHit {
  type: string
  result: {
    id: number
    title: string
    artist_names: string
    song_art_image_thumbnail_url: string | null
    path: string
  }
}

export type StreamEvent =
  | { type: 'line'; data: LyricLineData }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'processing' }

export type Role = 'ROLE_USER' | 'ROLE_ADMIN'

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SONG_NOT_FOUND'
  | 'LYRICS_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'LYRICS_PROCESSING'
  | 'GENIUS_API_ERROR'
  | 'OPENAI_API_ERROR'
  | 'SPOTIFY_AUTH_ERROR'
  | 'SCRAPING_FAILED'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR'

export interface ApiErrorResponse {
  timestamp: string
  path: string
  status: number
  code: ErrorCode
  message: string
  details: unknown | null
}

export interface PaginationMeta {
  page: number
  size: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}
