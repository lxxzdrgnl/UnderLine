'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type SearchType = 'songs' | 'artists' | 'albums'

const TABS: { key: SearchType; label: string }[] = [
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResultItem = any

export default function SearchPage() {
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
            // dedupe by id
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

  // Debounced search — reset to page 1
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

  // Initial load from URL params
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.length >= 2) {
      currentQuery.current = q
      doSearch(q, type, 1, false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load more
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return
    const nextPage = page + 1
    setPage(nextPage)
    doSearch(currentQuery.current, type, nextPage, true)
  }, [hasMore, loadingMore, loading, page, type, doSearch])

  // IntersectionObserver
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
      <h1 style={{
        margin: '32px 0 24px',
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 'var(--text-2xl)',
        fontWeight: 400,
        color: 'var(--text)',
      }}>
        검색
      </h1>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="노래, 아티스트, 앨범 검색..."
        style={{
          width: '100%',
          padding: '12px 16px',
          fontSize: 'var(--text-base)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          color: 'var(--text)',
          outline: 'none',
          marginBottom: '20px',
        }}
      />

      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setType(tab.key)}
            style={{
              padding: '8px 18px',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all var(--dur)',
              background: type === tab.key ? 'var(--accent)' : 'var(--bg-subtle)',
              color: type === tab.key ? '#000' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="spinner" style={{ margin: '40px auto' }} />}

      {!loading && results.length === 0 && query.length >= 2 && (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '40px 0' }}>
          검색 결과가 없어요
        </p>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {type === 'songs' && results.map((s: { genius_id: string; title: string; artist: string; image_url: string | null }) => (
            <Link
              key={s.genius_id}
              href={`/songs/${s.genius_id}`}
              className="hover-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '10px 12px', borderRadius: 'var(--r-md)',
                textDecoration: 'none', transition: 'background var(--dur)',
              }}
            >
              {s.image_url && (
                <img src={s.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.artist}</p>
              </div>
            </Link>
          ))}

          {type === 'artists' && results.map((a: { id: string; name: string; image_url: string | null }) => (
            <Link
              key={a.id}
              href={`/artists/${a.id}`}
              className="hover-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '10px 12px', borderRadius: 'var(--r-md)',
                textDecoration: 'none', transition: 'background var(--dur)',
              }}
            >
              {a.image_url && (
                <img src={a.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)' }}>{a.name}</p>
            </Link>
          ))}

          {type === 'albums' && results.map((al: { id: string; name: string; cover_art_url: string | null; artist: string }) => (
            <Link
              key={al.id}
              href={`/albums/${al.id}`}
              className="hover-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '10px 12px', borderRadius: 'var(--r-md)',
                textDecoration: 'none', transition: 'background var(--dur)',
              }}
            >
              {al.cover_art_url && (
                <img src={al.cover_art_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{al.name}</p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{al.artist}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          {loadingMore && <div className="spinner" />}
        </div>
      )}
    </div>
  )
}
