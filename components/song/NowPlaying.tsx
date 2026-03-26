'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { NowPlayingTrack } from '@/lib/spotify'

const POLL_INTERVAL = 30_000

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const LS_KEY = 'ul_search_history'

export function NowPlaying({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [track, setTrack] = useState<NowPlayingTrack | null | undefined>(undefined)
  const [progress, setProgress] = useState(0)
  const [navigating, setNavigating] = useState(false)
  const router = useRouter()

  const handleClick = useCallback(async () => {
    if (!track || navigating) return
    setNavigating(true)
    try {
      const res = await fetch(`/api/songs/search?q=${encodeURIComponent(`${track.title} ${track.artist}`)}`)
      const data = await res.json()
      const results: Array<{ genius_id: string; title: string; artist: string; image_url: string | null; db_id: string | null; lyrics_status: string | null }> = data.results ?? []
      if (results.length === 0) { setNavigating(false); return }

      // Find best match by title+artist similarity instead of blindly taking first
      function normalize(s: string) { return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') }
      const trackTitle = normalize(track.title)
      const trackArtist = normalize(track.artist)
      function score(r: { title: string; artist: string }) {
        const t = normalize(r.title)
        const a = normalize(r.artist)
        let s = 0
        if (t === trackTitle) s += 4
        else if (t.includes(trackTitle) || trackTitle.includes(t)) s += 2
        if (a === trackArtist) s += 3
        else if (a.includes(trackArtist) || trackArtist.includes(a)) s += 1
        return s
      }
      const first = results.reduce((best, r) => score(r) >= score(best) ? r : best, results[0])
      if (!first) { setNavigating(false); return }

      let songId = first.db_id
      if (!songId) {
        const post = await fetch('/api/songs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(first),
        })
        const d = await post.json()
        songId = d.id
      }

      // 검색 기록 저장
      const historyItem = { genius_id: first.genius_id, title: first.title, artist: first.artist, image_url: first.image_url }
      if (isLoggedIn) {
        fetch('/api/user/search-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(historyItem),
        }).catch(() => {})
      } else {
        try {
          const existing = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]')
          const updated = [historyItem, ...existing.filter((h: { genius_id: string }) => h.genius_id !== first.genius_id)].slice(0, 10)
          localStorage.setItem(LS_KEY, JSON.stringify(updated))
        } catch {}
      }

      router.push(`/songs/${songId}`)
    } catch {
      // 조용히 무시
    } finally {
      setNavigating(false)
    }
  }, [track, navigating, router, isLoggedIn])

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
        gap: '12px',
        padding: '12px 0',
        borderTop: '1px solid var(--border)',
        maxWidth: '560px',
        width: '100%',
        cursor: navigating ? 'wait' : 'pointer',
        opacity: navigating ? 0.6 : 1,
        transition: 'opacity 200ms',
      }}
      onClick={handleClick}
      title="이 곡의 가사 보기"
    >
      {/* 앨범 아트 */}
      {track.image_url && (
        <img
          src={track.image_url}
          alt=""
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--r-sm)',
            objectFit: 'cover',
            flexShrink: 0,
            opacity: track.is_playing ? 1 : 0.5,
          }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 재생 상태 표시 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '2px',
        }}>
          {track.is_playing ? (
            <span style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '10px' }}>
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    width: '2px',
                    background: 'var(--accent)',
                    borderRadius: '1px',
                    animation: `eq-bar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                    height: `${3 + i * 2}px`,
                  }}
                />
              ))}
            </span>
          ) : (
            <span style={{ width: '2px', height: '8px', background: 'var(--text-faint)', borderRadius: '1px', display: 'inline-block' }} />
          )}
          <span style={{
            fontSize: '10px',
            color: track.is_playing ? 'var(--accent)' : 'var(--text-faint)',
            fontWeight: 600,
            letterSpacing: '0.08em',
          }}>
            {track.is_playing ? 'NOW PLAYING' : 'PAUSED'}
          </span>
        </div>

        {/* 곡명 · 아티스트 */}
        <p style={{
          margin: '0 0 1px',
          fontSize: '14px',
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
