'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type SearchType = 'songs' | 'artists' | 'albums'

const TABS: { key: SearchType; label: string }[] = [
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
]

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [type, setType] = useState<SearchType>((searchParams.get('type') as SearchType) ?? 'songs')
  const [results, setResults] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async (q: string, t: SearchType) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${t}`)
      if (res.ok) setResults(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        router.replace(`/search?q=${encodeURIComponent(query)}&type=${type}`, { scroll: false })
        doSearch(query, type)
      } else {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, type, doSearch, router])

  // Initial load from URL params
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.length >= 2) doSearch(q, type)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Search input */}
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

      {/* Tabs */}
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

      {/* Results */}
      {loading && <div className="spinner" style={{ margin: '40px auto' }} />}

      {!loading && results.length === 0 && query.length >= 2 && (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '40px 0' }}>
          검색 결과가 없어요
        </p>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {type === 'songs' && (results as Array<{ genius_id: string; title: string; artist: string; image_url: string | null }>).map((s) => (
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
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.artist}</p>
              </div>
            </Link>
          ))}

          {type === 'artists' && (results as Array<{ id: string; name: string; image_url: string | null }>).map((a) => (
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
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)' }}>{a.name}</p>
            </Link>
          ))}

          {type === 'albums' && (results as Array<{ id: string; name: string; cover_art_url: string | null; artist: string }>).map((al) => (
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
                // eslint-disable-next-line @next/next/no-img-element
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
    </div>
  )
}
