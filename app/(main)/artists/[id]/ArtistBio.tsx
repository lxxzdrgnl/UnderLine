'use client'

import { useState } from 'react'

const TRUNCATE_LENGTH = 150

export function ArtistBio({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncate = text.length > TRUNCATE_LENGTH

  return (
    <div style={{ maxWidth: '640px' }}>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        {needsTruncate && !expanded ? text.slice(0, TRUNCATE_LENGTH) + '…' : text}
      </p>
      {needsTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 0', marginTop: '4px',
            fontSize: 'var(--text-xs)', fontWeight: 600,
            color: 'var(--text-faint)',
            transition: 'color 150ms',
          }}
          className="hover-dim"
        >
          {expanded ? '접기' : '더 보기'}
        </button>
      )}
    </div>
  )
}
