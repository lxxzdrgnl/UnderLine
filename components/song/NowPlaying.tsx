'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { NowPlayingTrack } from '@/lib/spotify'

const POLL_INTERVAL = 30_000

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function NowPlaying() {
  const [track, setTrack] = useState<NowPlayingTrack | null | undefined>(undefined)
  const [progress, setProgress] = useState(0)
  const router = useRouter()

  const fetchTrack = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify/now-playing')
      if (res.status === 401) { setTrack(null); return }
      const data: NowPlayingTrack | null = await res.json()
      setTrack(data)
      setProgress(data?.progress_ms ?? 0)
    } catch {
      // 네트워크 오류는 조용히 무시
    }
  }, [])

  // API 폴링 — 30초마다
  useEffect(() => {
    fetchTrack()
    const id = setInterval(fetchTrack, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchTrack])

  // 로컬 진행 바 — 재생 중일 때만 1초마다 +1000ms, 끝에 닿으면 즉시 재조회
  useEffect(() => {
    if (!track?.is_playing) return
    const id = setInterval(() => {
      setProgress((p) => {
        const next = p + 1000
        if (next >= track.duration_ms) {
          fetchTrack()
          return track.duration_ms
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [track?.is_playing, track?.duration_ms, fetchTrack])

  // 로딩 중 또는 재생 없음 → 렌더링 안 함
  if (track === undefined || track === null) return null

  const progressPct = track.duration_ms > 0
    ? (progress / track.duration_ms) * 100
    : 0

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 18px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        maxWidth: '440px',
        width: '100%',
        cursor: 'pointer',
      }}
      onClick={() => router.push(`/?q=${encodeURIComponent(`${track.title} ${track.artist}`)}`)}
      title="이 곡 검색하기"
    >
      {/* 앨범 아트 */}
      {track.image_url && (
        <img
          src={track.image_url}
          alt=""
          style={{
            width: '52px',
            height: '52px',
            borderRadius: 'var(--r-sm)',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 재생 상태 표시 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '4px',
        }}>
          {track.is_playing ? (
            <span style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '12px' }}>
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    width: '3px',
                    background: '#1DB954',
                    borderRadius: '1px',
                    animation: `eq-bar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                    height: `${4 + i * 3}px`,
                  }}
                />
              ))}
            </span>
          ) : (
            <span style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.05em' }}>
              ■
            </span>
          )}
          <span style={{
            fontSize: 'var(--text-xs)',
            color: '#1DB954',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}>
            {track.is_playing ? 'NOW PLAYING' : 'PAUSED'}
          </span>
        </div>

        {/* 곡명 · 아티스트 */}
        <p style={{
          margin: '0 0 2px',
          fontSize: 'var(--text-base)',
          fontWeight: 500,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {track.title}
        </p>
        <p style={{
          margin: '0 0 8px',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {track.artist}
        </p>

        {/* 진행 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-faint)', flexShrink: 0 }}>
            {formatTime(progress)}
          </span>
          <div style={{
            flex: 1,
            height: '3px',
            background: 'var(--bg-subtle)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              background: '#1DB954',
              borderRadius: '2px',
              transition: 'width 0.9s linear',
            }} />
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-faint)', flexShrink: 0 }}>
            {formatTime(track.duration_ms)}
          </span>
        </div>
      </div>
    </div>
  )
}
