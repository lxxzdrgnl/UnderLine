'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { GeniusSearchResult } from '@/types'

interface SearchResult extends GeniusSearchResult {
  db_id: string | null
  lyrics_status: string | null
}

interface HistoryItem {
  id?: string
  genius_id: string
  title: string
  artist: string
  image_url: string | null
}

const LS_KEY = 'ul_search_history'
const MAX_LOCAL = 10

interface Props {
  isLoggedIn?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SearchBar({ isLoggedIn = false, onOpenChange }: Props) {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [searchPage, setSearchPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)
  const currentQuery = useRef('')
  const router = useRouter()

  const showHistory = isFocused && query.trim().length < 2 && history.length > 0
  const showResults = isFocused && !showHistory && results.length > 0

  // ── History: load ──────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (isLoggedIn) {
      try {
        const res = await fetch('/api/user/search-history?limit=10')
        const data = await res.json()
        setHistory(Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [])
      } catch { setHistory([]) }
    } else {
      try {
        const raw = localStorage.getItem(LS_KEY)
        setHistory(raw ? JSON.parse(raw) : [])
      } catch { setHistory([]) }
    }
  }, [isLoggedIn])

  useEffect(() => { loadHistory() }, [loadHistory])

  // ── History: save ──────────────────────────────────────
  const saveHistory = useCallback(async (item: HistoryItem) => {
    if (isLoggedIn) {
      try {
        await fetch('/api/user/search-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
        await loadHistory()
      } catch {}
    } else {
      try {
        const raw = localStorage.getItem(LS_KEY)
        const existing: HistoryItem[] = raw ? JSON.parse(raw) : []
        const filtered = existing.filter((h) => h.genius_id !== item.genius_id)
        const updated = [item, ...filtered].slice(0, MAX_LOCAL)
        localStorage.setItem(LS_KEY, JSON.stringify(updated))
        setHistory(updated)
      } catch {}
    }
  }, [isLoggedIn, loadHistory])

  // ── History: delete ────────────────────────────────────
  const deleteHistory = useCallback(async (genius_id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (isLoggedIn) {
      try {
        await fetch(`/api/user/search-history?genius_id=${encodeURIComponent(genius_id)}`, { method: 'DELETE' })
        setHistory((prev) => prev.filter((h) => h.genius_id !== genius_id))
      } catch {}
    } else {
      try {
        const raw = localStorage.getItem(LS_KEY)
        const existing: HistoryItem[] = raw ? JSON.parse(raw) : []
        const updated = existing.filter((h) => h.genius_id !== genius_id)
        localStorage.setItem(LS_KEY, JSON.stringify(updated))
        setHistory(updated)
      } catch {}
    }
  }, [isLoggedIn])

  // ── URL param sync ─────────────────────────────────────
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    if (q) setQuery(q)
  }, [searchParams])

  // ── Debounced search ───────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) { setResults([]); setHasMore(false); return }

    debounceRef.current = setTimeout(async () => {
      currentQuery.current = query
      setLoading(true)
      setSearchPage(1)
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(query)}&page=1`)
        const data = await res.json()
        setResults(data.results ?? [])
        setHasMore(data.hasMore ?? false)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // ── Load more on dropdown scroll ─────────────────────
  const handleDropdownScroll = useCallback(async () => {
    const el = dropdownRef.current
    if (!el || loadingMore || !hasMore) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100
    if (!nearBottom) return

    setLoadingMore(true)
    const nextPage = searchPage + 1
    try {
      const res = await fetch(`/api/songs/search?q=${encodeURIComponent(currentQuery.current)}&page=${nextPage}`)
      const data = await res.json()
      const newResults = data.results ?? []
      setResults((prev) => {
        const ids = new Set(prev.map((r) => r.genius_id))
        return [...prev, ...newResults.filter((r: SearchResult) => !ids.has(r.genius_id))]
      })
      setHasMore(data.hasMore ?? false)
      setSearchPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, searchPage])

  // ── Select song ────────────────────────────────────────
  const handleSelect = async (result: SearchResult) => {
    await saveHistory({
      genius_id: result.genius_id,
      title: result.title,
      artist: result.artist,
      image_url: result.image_url,
    })
    let songId = result.db_id
    if (!songId) {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      })
      const data = await res.json()
      songId = data.id
    }
    setIsFocused(false)
    router.push(`/songs/${songId}`)
  }

  // ── Navigate from history ──────────────────────────────
  const handleHistorySelect = (item: HistoryItem) => {
    setIsFocused(false)
    router.push(`/songs/${item.genius_id}`)
  }

  const isOpen = showHistory || showResults || loading

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '640px', zIndex: 50 }}>
      {/* ── Search input ── */}
      <div style={{
        position: 'relative',
        borderRadius: isOpen ? '8px 8px 0 0' : '8px',
        background: 'var(--bg-surface)',
        border: `1px solid ${isFocused ? 'rgba(255,255,255,0.12)' : 'var(--border)'}`,
        borderBottom: isOpen ? 'none' : undefined,
        transition: 'border-color 200ms, border-radius 150ms',
      }}>
        {/* Search icon */}
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        >
          <circle cx="10.5" cy="10.5" r="6.5" stroke={isFocused ? 'var(--text)' : 'var(--text-faint)'} strokeWidth="2"/>
          <path d="M15.5 15.5L20 20" stroke={isFocused ? 'var(--text)' : 'var(--text-faint)'} strokeWidth="2" strokeLinecap="round"/>
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
            setIsFocused(true)
            onOpenChange?.(true)
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => {
              setIsFocused(false)
              onOpenChange?.(false)
            }, 200)
          }}
          placeholder="어떤 곡의 숨겨진 의미가 궁금하신가요?"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            padding: '14px 44px 14px 46px',
            fontSize: '14px',
            outline: 'none',
            fontWeight: 500,
          }}
        />

        {/* Loading indicator */}
        {loading && (
          <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }}>
            <div className="spinner-sm" />
          </div>
        )}

        {/* Clear button */}
        {query.length > 0 && !loading && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setQuery(''); setResults([]) }}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1,
              transition: 'background 120ms',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Dropdown ── */}
      {isOpen && (
        <ul
          ref={showResults ? dropdownRef : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onScroll={showResults ? handleDropdownScroll : undefined}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--bg-surface)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxHeight: '380px',
            overflowY: 'auto',
            transformOrigin: 'top',
            animation: 'dropdown-in 150ms var(--ease) both',
          }}
        >
          {/* Loading state */}
          {loading && (
            <li style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-faint)' }}>검색 중...</p>
            </li>
          )}

          {/* History */}
          {showHistory && (
            <>
              <li style={{ padding: '12px 16px 8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                  최근 검색
                </span>
              </li>
              {history.map((item) => (
                <li
                  key={item.genius_id}
                  onClick={() => handleHistorySelect(item)}
                  className="search-dropdown-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '8px 16px', cursor: 'pointer',
                    transition: 'background 80ms',
                  }}
                >
                  {/* Clock icon */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '4px', flexShrink: 0,
                    overflow: 'hidden', background: '#333',
                  }}>
                    {item.image_url ? (
                      <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '16px' }}>♪</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: '12px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.artist}
                    </p>
                  </div>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => deleteHistory(item.genius_id, e)}
                    className="search-delete-btn"
                    style={{
                      flexShrink: 0, width: '28px', height: '28px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', borderRadius: '50%',
                      cursor: 'pointer', color: 'var(--text-faint)', fontSize: '14px',
                      opacity: 0, transition: 'opacity 120ms, background 120ms',
                    }}
                    title="삭제"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </>
          )}

          {/* Search results */}
          {showResults && results.map((r, idx) => (
            <li
              key={r.genius_id}
              onClick={() => handleSelect(r)}
              className="search-dropdown-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 16px', cursor: 'pointer',
                transition: 'background 80ms',
              }}
            >
              <div style={{
                width: '40px', height: '40px', borderRadius: '4px', flexShrink: 0,
                overflow: 'hidden', background: '#333',
              }}>
                {r.image_url ? (
                  <img src={r.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '16px' }}>♪</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </p>
                <p style={{ margin: '1px 0 0', fontSize: '12px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  노래 · {r.artist}
                </p>
              </div>
              {r.lyrics_status === 'DONE' && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
                  color: 'var(--accent)', flexShrink: 0,
                  padding: '3px 8px', borderRadius: '10px',
                  background: 'var(--accent-bg)',
                }}>
                  해석 완료
                </span>
              )}
            </li>
          ))}

          {/* Load more spinner */}
          {loadingMore && (
            <li style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
              <div className="spinner-sm" />
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
