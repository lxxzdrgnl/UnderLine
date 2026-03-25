'use client'

import { useState, useEffect, useRef } from 'react'

const MAX_PLAYLISTS = 50

interface Playlist {
  id: string
  name: string
  songCount: number
  isDefault: boolean
}

interface Props {
  songId: string
  savedPlaylistIds: string[]
  onClose: () => void
  onUpdate: (ids: string[]) => void
}

export function FavoriteModal({ songId, savedPlaylistIds, onClose, onUpdate }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(savedPlaylistIds))
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/playlists')
      .then((r) => r.json())
      .then((data) => {
        setPlaylists(data.playlists ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  async function handleToggle(playlistId: string) {
    const isChecked = checkedIds.has(playlistId)
    const next = new Set(checkedIds)

    if (isChecked) {
      next.delete(playlistId)
      setCheckedIds(next)
      onUpdate(Array.from(next))
      const res = await fetch(`/api/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE' })
      if (!res.ok) {
        next.add(playlistId)
        setCheckedIds(new Set(next))
        onUpdate(Array.from(next))
      }
    } else {
      next.add(playlistId)
      setCheckedIds(next)
      onUpdate(Array.from(next))
      await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId }),
      })
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreateError('')
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const created = await res.json()
      setPlaylists((prev) => [...prev, { id: created.id, name: created.name, songCount: 0, isDefault: false }])
      setShowCreate(false)
      setNewName('')
      // Auto-add the song to the new playlist
      handleToggle(created.id)
    } else {
      const data = await res.json()
      if (data.error === 'playlist_name_taken') setCreateError('이미 같은 이름이 있어요')
      else if (data.limitReached) setCreateError('최대 50개까지 만들 수 있어요')
    }
  }

  const atLimit = playlists.length >= MAX_PLAYLISTS

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div ref={ref} style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r-xl)',
        padding: '24px',
        minWidth: '320px',
        maxWidth: '400px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{
          margin: '0 0 16px', fontSize: 'var(--text-md)',
          fontWeight: 600, color: 'var(--text)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          저장할 목록 선택
        </h3>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: '36px', borderRadius: 'var(--r-md)' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {playlists.map((p) => (
              <label
                key={p.id}
                className="hover-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: 'var(--r-md)',
                  cursor: 'pointer', fontSize: 'var(--text-sm)',
                  color: 'var(--text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(p.id)}
                  onChange={() => handleToggle(p.id)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span style={{ flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                  {p.songCount}곡
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Create new */}
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          {!showCreate ? (
            <button
              onClick={() => !atLimit && setShowCreate(true)}
              disabled={atLimit}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: 'var(--text-sm)',
                background: 'none',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--r-md)',
                cursor: atLimit ? 'not-allowed' : 'pointer',
                color: atLimit ? 'var(--text-faint)' : 'var(--text-muted)',
                opacity: atLimit ? 0.5 : 1,
              }}
            >
              + 새 플레이리스트
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="이름 입력"
                autoFocus
                style={{
                  flex: 1, padding: '8px 10px', fontSize: 'var(--text-sm)',
                  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', color: 'var(--text)', outline: 'none',
                }}
              />
              <button
                onClick={handleCreate}
                style={{
                  padding: '8px 12px', fontSize: 'var(--text-sm)',
                  background: 'var(--accent)', color: '#000', border: 'none',
                  borderRadius: 'var(--r-md)', cursor: 'pointer', fontWeight: 500,
                }}
              >
                확인
              </button>
            </div>
          )}
          {atLimit && !showCreate && (
            <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
              최대 50개까지 만들 수 있어요
            </p>
          )}
          {createError && (
            <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: '#e55' }}>{createError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
