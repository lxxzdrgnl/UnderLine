'use client'

import { useState } from 'react'

const TRUNCATE_LENGTH = 150

interface Props {
  text: string
  artistId?: string
  originalOffset?: number
}

export function ArtistBio({ text, artistId, originalOffset }: Props) {
  const [displayText, setDisplayText] = useState(text)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const needsTruncate = displayText.length > TRUNCATE_LENGTH
  const hasMore = needsTruncate || !!artistId

  async function handleExpand() {
    setExpanded(true)
    if (artistId && originalOffset !== undefined) {
      setLoading(true)
      try {
        const res = await fetch(`/api/artists/${artistId}/bio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset: originalOffset, preview: text }),
        })
        const data = await res.json()
        if (data.suffix) setDisplayText(text + ' ' + data.suffix)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div style={{ maxWidth: '640px', textAlign: 'center' }}>
      {/* Single <p> — preview and extra text flow seamlessly */}
      <p
        onClick={expanded ? () => setExpanded(false) : undefined}
        style={{
          margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.7,
          cursor: expanded ? 'pointer' : 'default',
        }}
      >
        {displayText.slice(0, TRUNCATE_LENGTH)}
        {!expanded && hasMore && '… '}
        {expanded && !loading && displayText.slice(TRUNCATE_LENGTH)}
        {hasMore && (
          <button
            onClick={expanded ? (e) => { e.stopPropagation(); setExpanded(false) } : (e) => { e.stopPropagation(); handleExpand() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, margin: '0 0 0 2px',
              fontSize: 'var(--text-xs)', fontWeight: 600,
              color: 'var(--text-faint)',
              verticalAlign: 'baseline',
              transition: 'color 150ms',
            }}
            className="hover-dim"
          >
            {expanded ? '접기' : '더 보기'}
          </button>
        )}
      </p>

      {/* Skeleton shown below while translating */}
      {loading && (
        <div style={{ marginTop: '6px' }}>
          <div className="skeleton" style={{ width: '100%', height: '14px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '90%', height: '14px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '65%', height: '14px' }} />
        </div>
      )}
    </div>
  )
}
