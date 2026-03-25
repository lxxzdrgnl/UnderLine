'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SongLink } from '@/components/SongLink'

type Song = { genius_id: string; title: string; artist: string; image_url: string | null }

export function ArtistSongs({ artistId, initialSongs }: { artistId: string; initialSongs: Song[] }) {
  const [songs, setSongs] = useState(initialSongs)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialSongs.length >= 20)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    const nextPage = page + 1
    try {
      const res = await fetch(`/api/artists/${artistId}/songs?page=${nextPage}`)
      if (res.ok) {
        const data = await res.json()
        const newSongs: Song[] = data.songs ?? []
        setSongs((prev) => {
          const ids = new Set(prev.map((s) => s.genius_id))
          return [...prev, ...newSongs.filter((s) => !ids.has(s.genius_id))]
        })
        setHasMore(newSongs.length >= 20)
        setPage(nextPage)
      }
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, page, artistId])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {songs.map((song, idx) => (
          <SongLink
            key={song.genius_id}
            song={song}
            className="hover-row"
            style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '10px 12px', borderRadius: 'var(--r-md)',
              textDecoration: 'none', transition: 'background 120ms',
            }}
          >
            <span style={{ width: '20px', textAlign: 'right', flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
              {idx + 1}
            </span>
            {song.image_url && (
              <img src={song.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {song.title}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {song.artist}
              </p>
            </div>
          </SongLink>
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          {loading && <div className="spinner" />}
        </div>
      )}
    </>
  )
}
