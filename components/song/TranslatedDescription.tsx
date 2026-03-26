'use client'

import { useState, useEffect } from 'react'

interface Props {
  text: string
  songId: string
  cached: string | null
}

export function TranslatedDescription({ text, songId, cached }: Props) {
  const [translated, setTranslated] = useState<string | null>(cached)
  const [loading, setLoading] = useState(false)

  const koreanRatio = (text.match(/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/g) ?? []).length / text.length
  const isAlreadyKorean = koreanRatio > 0.1

  useEffect(() => {
    // Already have translation (from DB cache or already Korean)
    if (cached || isAlreadyKorean) return

    setLoading(true)
    fetch(`/api/songs/${songId}/translate-description`, { method: 'POST' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.translated) setTranslated(data.translated)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [songId, isAlreadyKorean, cached])

  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="skeleton" style={{ height: '14px', width: '90%', borderRadius: 'var(--r-sm)' }} />
          <div className="skeleton" style={{ height: '14px', width: '75%', borderRadius: 'var(--r-sm)' }} />
          <div className="skeleton" style={{ height: '14px', width: '60%', borderRadius: 'var(--r-sm)' }} />
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          {translated ?? text}
        </p>
      )}
    </div>
  )
}
