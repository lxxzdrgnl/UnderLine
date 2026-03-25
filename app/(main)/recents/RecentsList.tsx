'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface Entry {
  id: string
  genius_id: string
  title: string
  artist: string
  image_url: string | null
  updatedAt: string
}

function formatDateGroup(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diff = today.getTime() - d.getTime()
  if (diff === 0) return '오늘'
  if (diff === 86400000) return '어제'

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function groupByDate(entries: Entry[]): Map<string, Entry[]> {
  const groups = new Map<string, Entry[]>()
  for (const entry of entries) {
    const label = formatDateGroup(entry.updatedAt)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(entry)
  }
  return groups
}

interface Props {
  initialEntries: Entry[]
  initialCursor: string | null
}

export function RecentsList({ initialEntries, initialCursor }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  async function handleDelete(geniusId: string) {
    setEntries((prev) => prev.filter((e) => e.genius_id !== geniusId))
    await fetch(`/api/user/search-history?genius_id=${geniusId}`, { method: 'DELETE' })
  }

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/user/search-history?cursor=${cursor}&limit=20`)
      const data = await res.json()
      if (data.items?.length) {
        setEntries((prev) => [...prev, ...data.items.map((e: Entry & { updatedAt: string }) => ({
          ...e,
          updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : new Date(e.updatedAt).toISOString(),
        }))])
        setCursor(data.nextCursor)
      } else {
        setCursor(null)
      }
    } finally {
      setLoading(false)
    }
  }, [cursor, loading])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  const filtered = query.trim()
    ? entries.filter((e) =>
        e.title.toLowerCase().includes(query.toLowerCase()) ||
        e.artist.toLowerCase().includes(query.toLowerCase())
      )
    : entries
  const groups = groupByDate(filtered)

  if (entries.length === 0) {
    return (
      <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '60px 0' }}>
        아직 검색 기록이 없어요
      </p>
    )
  }

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="검색 기록에서 찾기..."
        style={{
          width: '100%',
          padding: '10px 14px',
          fontSize: 'var(--text-sm)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          color: 'var(--text)',
          outline: 'none',
          marginBottom: '20px',
        }}
      />

      {filtered.length === 0 && query.trim() && (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '40px 0' }}>
          검색 결과가 없어요
        </p>
      )}

      {Array.from(groups.entries()).map(([label, items]) => (
        <section key={label} style={{ marginBottom: '28px' }}>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {label}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((entry) => (
              <div
                key={entry.id}
                className="hover-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '10px 12px', borderRadius: 'var(--r-md)',
                  transition: 'background var(--dur)',
                }}
              >
                <Link
                  href={`/songs/${entry.genius_id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    flex: 1, minWidth: 0, textDecoration: 'none',
                  }}
                >
                  {entry.image_url && (
                    <img src={entry.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.title}
                    </p>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.artist}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(entry.genius_id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-faint)', fontSize: '16px', padding: '4px 8px',
                    flexShrink: 0, lineHeight: 1, opacity: 0.5,
                    transition: 'opacity var(--dur)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5' }}
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Infinite scroll sentinel */}
      {cursor && (
        <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          {loading && <div className="spinner" />}
        </div>
      )}
    </>
  )
}
