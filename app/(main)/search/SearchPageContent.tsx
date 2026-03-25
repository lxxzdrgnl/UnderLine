'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const LS_KEY = 'ul_search_history'
const MAX_LOCAL = 10

type SearchType = 'songs' | 'artists' | 'albums'

const TABS: { key: SearchType; label: string }[] = [
  { key: 'songs', label: '노래' },
  { key: 'artists', label: '아티스트' },
  { key: 'albums', label: '앨범' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResultItem = any

export function SearchPageContent({ isLoggedIn }: { isLoggedIn: boolean }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [type, setType] = useState<SearchType>((searchParams.get('type') as SearchType) ?? 'songs')
  const [results, setResults] = useState<ResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const currentQuery = useRef('')

  const doSearch = useCallback(async (q: string, t: SearchType, p: number, append: boolean) => {
    if (q.length < 2) { setResults([]); setHasMore(false); return }
    if (p === 1) setLoading(true)
    else setLoadingMore(true)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${t}&page=${p}`)
      if (res.ok) {
        const data = await res.json()
        const items = data.items ?? data
        if (append) {
          setResults((prev) => {
            const ids = new Set(prev.map((r: ResultItem) => r.genius_id ?? r.id))
            return [...prev, ...items.filter((r: ResultItem) => !ids.has(r.genius_id ?? r.id))]
          })
        } else {
          setResults(items)
        }
        setHasMore(data.hasMore ?? false)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        currentQuery.current = query
        router.replace(`/search?q=${encodeURIComponent(query)}&type=${type}`, { scroll: false })
        setPage(1)
        doSearch(query, type, 1, false)
      } else {
        setResults([])
        setHasMore(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, type, doSearch, router])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.length >= 2) {
      currentQuery.current = q
      doSearch(q, type, 1, false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSongSelect = useCallback((s: { genius_id: string; title: string; artist: string; image_url: string | null }) => {
    if (isLoggedIn) {
      fetch('/api/user/search-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genius_id: s.genius_id, title: s.title, artist: s.artist, image_url: s.image_url }),
      }).catch(() => {})
    } else {
      try {
        const raw = localStorage.getItem(LS_KEY)
        const existing = raw ? JSON.parse(raw) : []
        const updated = [
          { genius_id: s.genius_id, title: s.title, artist: s.artist, image_url: s.image_url },
          ...existing.filter((h: { genius_id: string }) => h.genius_id !== s.genius_id),
        ].slice(0, MAX_LOCAL)
        localStorage.setItem(LS_KEY, JSON.stringify(updated))
      } catch {}
    }
    router.push(`/songs/${s.genius_id}`)
  }, [isLoggedIn, router])

  const handleArtistSelect = useCallback((a: { id: string; name: string; image_url: string | null }) => {
    if (isLoggedIn) {
      fetch('/api/user/search-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genius_id: `artist:${a.id}`, title: a.name, artist: '', image_url: a.image_url, type: 'artist' }),
      }).catch(() => {})
    }
    router.push(`/artists/${a.id}`)
  }, [isLoggedIn, router])

  const handleAlbumSelect = useCallback((al: { id: string; name: string; cover_art_url: string | null; artist: string }) => {
    if (isLoggedIn) {
      fetch('/api/user/search-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genius_id: `album:${al.id}`, title: al.name, artist: al.artist, image_url: al.cover_art_url, type: 'album' }),
      }).catch(() => {})
    }
    router.push(`/albums/${al.id}`)
  }, [isLoggedIn, router])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return
    const nextPage = page + 1
    setPage(nextPage)
    doSearch(currentQuery.current, type, nextPage, true)
  }, [hasMore, loadingMore, loading, page, type, doSearch])

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
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      {/* Search input with icon */}
      <div style={{ position: 'relative', margin: '24px 0 16px' }}>
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none"
          style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <circle cx="10.5" cy="10.5" r="7" stroke="var(--text-faint)" strokeWidth="2"/>
          <path d="M15.5 15.5L21 21" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="무엇을 듣고 싶으세요?"
          style={{
            width: '100%',
            padding: '14px 16px 14px 44px',
            fontSize: '14px',
            background: '#fff',
            border: 'none',
            borderRadius: '24px',
            color: '#000',
            outline: 'none',
            fontWeight: 500,
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setType(tab.key)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: type === tab.key ? 700 : 500,
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 150ms',
              background: type === tab.key ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
              color: type === tab.key ? '#000' : 'var(--text)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <div className="spinner" style={{ margin: '40px auto' }} />}

      {/* Empty */}
      {!loading && results.length === 0 && query.length >= 2 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: '18px', margin: '0 0 8px', color: 'var(--text)' }}>
            &ldquo;{query}&rdquo;에 대한 검색 결과가 없어요
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-faint)', margin: 0 }}>
            다른 검색어를 시도해보세요
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {type === 'songs' && results.map((s: { genius_id: string; title: string; artist: string; image_url: string | null }, idx: number) => (
            <div
              key={s.genius_id}
              onClick={() => handleSongSelect(s)}
              className="hover-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 12px', borderRadius: 'var(--r-md)',
                cursor: 'pointer', transition: 'background 100ms',
                animation: `fade-up 200ms var(--ease) ${Math.min(idx, 10) * 30}ms both`,
              }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '4px', flexShrink: 0,
                background: '#333', overflow: 'hidden',
              }}>
                {s.image_url ? (
                  <img src={s.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '18px' }}>♪</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  노래 · {s.artist}
                </p>
              </div>
            </div>
          ))}

          {type === 'artists' && results.map((a: { id: string; name: string; image_url: string | null }, idx: number) => (
            <div
              key={a.id}
              onClick={() => handleArtistSelect(a)}
              className="hover-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 12px', borderRadius: 'var(--r-md)',
                cursor: 'pointer', transition: 'background 100ms',
                animation: `fade-up 200ms var(--ease) ${Math.min(idx, 10) * 30}ms both`,
              }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                background: '#333', overflow: 'hidden',
              }}>
                {a.image_url ? (
                  <img src={a.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '16px' }}>♫</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{a.name}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-faint)' }}>아티스트</p>
              </div>
            </div>
          ))}

          {type === 'albums' && results.map((al: { id: string; name: string; cover_art_url: string | null; artist: string }, idx: number) => (
            <div
              key={al.id}
              onClick={() => handleAlbumSelect(al)}
              className="hover-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 12px', borderRadius: 'var(--r-md)',
                cursor: 'pointer', transition: 'background 100ms',
                animation: `fade-up 200ms var(--ease) ${Math.min(idx, 10) * 30}ms both`,
              }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '4px', flexShrink: 0,
                background: '#333', overflow: 'hidden',
              }}>
                {al.cover_art_url ? (
                  <img src={al.cover_art_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '16px' }}>♪</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{al.name}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  앨범 · {al.artist}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          {loadingMore && <div className="spinner" />}
        </div>
      )}
    </div>
  )
}
