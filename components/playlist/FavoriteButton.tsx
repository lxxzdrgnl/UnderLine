'use client'

import { useState, useEffect } from 'react'
import { FavoriteModal } from './FavoriteModal'

export function FavoriteButton({ songId }: { songId: string }) {
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetch(`/api/songs/${songId}/playlists`)
      .then((r) => {
        if (r.status === 401) { setHidden(true); return null }
        return r.json()
      })
      .then((data) => {
        if (data) setSavedIds(data.playlistIds ?? [])
        setLoading(false)
      })
  }, [songId])

  if (hidden) return null

  const isSaved = savedIds.length > 0

  return (
    <>
      <button
        onClick={() => !loading && setShowModal(true)}
        disabled={loading}
        style={{
          background: 'none',
          border: 'none',
          cursor: loading ? 'default' : 'pointer',
          padding: '4px',
          fontSize: '22px',
          lineHeight: 1,
          color: isSaved ? 'var(--accent)' : 'var(--text-faint)',
          opacity: loading ? 0.3 : 1,
          transition: 'color var(--dur), opacity var(--dur)',
        }}
        title={isSaved ? '저장됨' : '저장'}
      >
        {isSaved ? '♥' : '♡'}
      </button>

      {showModal && (
        <FavoriteModal
          songId={songId}
          savedPlaylistIds={savedIds}
          onClose={() => setShowModal(false)}
          onUpdate={(ids) => setSavedIds(ids)}
        />
      )}
    </>
  )
}
