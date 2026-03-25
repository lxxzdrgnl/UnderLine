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

  // ── Dropdown shared styles ─────────────────────────────
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 50,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    maxHeight: '360px',
    overflowY: 'auto',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border)',
    transition: 'background 120ms',
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '640px' }}>
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
          }, 150)
        }}
        placeholder="어떤 곡의 숨겨진 의미가 궁금하신가요?"
        style={{
          width: '100%',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--text)',
          padding: '14px 20px',
          fontSize: '15px',
          outline: 'none',
          transition: 'border-color 150ms',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-strong)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = isFocused ? 'var(--accent)' : 'var(--border)' }}
      />

      {loading && (
        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: 'var(--text-faint)' }}>
          검색 중…
        </div>
      )}

      {/* ── History dropdown ── */}
      {showHistory && (
        <ul style={dropdownStyle}>
          <li style={{ padding: '8px 16px 6px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              최근 검색
            </span>
          </li>
          {history.map((item) => (
            <li
              key={item.genius_id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleHistorySelect(item)}
              style={rowStyle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'var(--bg-subtle)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'transparent' }}
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt=""
                  style={{ width: '36px', height: '36px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: 'var(--r-sm)', background: 'var(--bg-elevated)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.artist}
                </p>
              </div>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => deleteHistory(item.genius_id, e)}
                style={{
                  flexShrink: 0,
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  color: 'var(--text-faint)',
                  fontSize: '16px',
                  lineHeight: 1,
                  padding: 0,
                  transition: 'background 120ms, color 120ms',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = 'var(--bg-elevated)'
                  el.style.color = 'var(--text)'
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = 'transparent'
                  el.style.color = 'var(--text-faint)'
                }}
                title="삭제"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Search results dropdown ── */}
      {isFocused && !showHistory && results.length > 0 && (
        <ul ref={dropdownRef} onScroll={handleDropdownScroll} style={dropdownStyle}>
          {results.map((r) => (
            <li
              key={r.genius_id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(r)}
              style={rowStyle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'var(--bg-subtle)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'transparent' }}
            >
              {r.image_url && (
                <img
                  src={r.image_url}
                  alt=""
                  style={{ width: '36px', height: '36px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.artist}
                </p>
              </div>
              {r.lyrics_status === 'DONE' && (
                <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--accent)', textTransform: 'uppercase', flexShrink: 0 }}>
                  완료
                </span>
              )}
            </li>
          ))}
          {loadingMore && (
            <li style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
              <div className="spinner" />
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
