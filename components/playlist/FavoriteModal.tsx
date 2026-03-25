'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const MAX_PLAYLISTS = 50

interface Playlist {
  id: string
  name: string
  songCount: number
  isDefault: boolean
  coverImage: string | null
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
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMobile(window.innerWidth < 640)
  }, [])

  useEffect(() => {
    fetch('/api/playlists')
      .then((r) => r.json())
      .then((d) => setPlaylists(d.playlists ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc) }
  }, [onClose])

  async function toggle(pid: string) {
    const has = checkedIds.has(pid)
    const next = new Set(checkedIds)
    if (has) next.delete(pid); else next.add(pid)
    setCheckedIds(next)
    onUpdate(Array.from(next))

    const ok = has
      ? await fetch(`/api/playlists/${pid}/songs/${songId}`, { method: 'DELETE' }).then((r) => r.ok)
      : await fetch(`/api/playlists/${pid}/songs`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId }),
        }).then((r) => r.ok)

    if (!ok && has) { next.add(pid); setCheckedIds(new Set(next)); onUpdate(Array.from(next)) }
  }

  async function create() {
    if (!newName.trim()) return
    setError('')
    const res = await fetch('/api/playlists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const c = await res.json()
      setPlaylists((p) => [...p, { id: c.id, name: c.name, songCount: 0, isDefault: false, coverImage: null }])
      setNewName('')
      setMode('list')
      toggle(c.id)
    } else {
      const d = await res.json()
      setError(d.error === 'playlist_name_taken' ? '이미 같은 이름이 있어요' : d.limitReached ? '최대 50개' : '오류')
    }
  }

  const atLimit = playlists.length >= MAX_PLAYLISTS

  const listContent = (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {loading ? (
          <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: '52px', borderRadius: '10px' }} />)}
          </div>
        ) : (
          playlists.map((p) => {
            const on = checkedIds.has(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                  padding: '10px', background: on ? 'var(--accent-bg)' : 'none', border: 'none',
                  cursor: 'pointer', borderRadius: '10px', textAlign: 'left',
                  transition: 'background 100ms',
                }}
                className={on ? undefined : 'hover-row'}
              >
                {/* Cover image */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: 'var(--r-sm)', flexShrink: 0,
                  background: 'var(--bg-subtle)', overflow: 'hidden',
                }}>
                  {p.coverImage ? (
                    <img src={p.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-faint)', fontSize: '16px',
                    }}>
                      {p.isDefault ? '♥' : '♪'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: '14px', fontWeight: 500, display: 'block',
                    color: on ? 'var(--accent)' : 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                    {p.songCount}곡
                  </span>
                </div>

                {/* Check */}
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  background: on ? 'var(--accent)' : 'transparent',
                  border: on ? 'none' : '2px solid var(--border-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms',
                }}>
                  {on && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 4" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {!atLimit && (
        <div style={{ padding: '6px 8px 12px' }}>
          <button
            onClick={() => setMode('create')}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
              padding: '10px', background: 'none', border: 'none',
              cursor: 'pointer', borderRadius: '10px', textAlign: 'left',
            }}
            className="hover-row"
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: 'var(--r-sm)',
              border: '2px dashed var(--border-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-faint)', fontSize: '18px',
            }}>+</div>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>새 플레이리스트</span>
          </button>
        </div>
      )}
    </>
  )

  const createContent = (
    <div style={{ padding: '0 20px 20px' }}>
      <input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
        placeholder="플레이리스트 이름"
        autoFocus
        style={{
          width: '100%', padding: '14px 16px', fontSize: '15px',
          background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-lg)', color: 'var(--text)', outline: 'none',
          marginBottom: '12px',
        }}
      />
      <button
        onClick={create}
        disabled={!newName.trim()}
        style={{
          width: '100%', padding: '13px', fontSize: '14px', fontWeight: 600,
          background: newName.trim() ? 'var(--accent)' : 'var(--bg-subtle)',
          color: newName.trim() ? '#000' : 'var(--text-faint)',
          border: 'none', borderRadius: 'var(--r-lg)', cursor: newName.trim() ? 'pointer' : 'default',
        }}
      >
        만들기
      </button>
      {error && <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#e55', textAlign: 'center' }}>{error}</p>}
    </div>
  )

  const header = (
    <div style={{ padding: isMobile ? '4px 20px 14px' : '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
        {mode === 'create' ? '새 플레이리스트' : '저장'}
      </span>
      {mode === 'create' ? (
        <button onClick={() => { setMode('list'); setNewName(''); setError('') }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px' }}>
          취소
        </button>
      ) : (
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '20px', lineHeight: 1 }}>
          ✕
        </button>
      )}
    </div>
  )

  // Mobile: bottom sheet
  if (isMobile) {
    return createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 70,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      }}>
        <div ref={ref} style={{
          background: '#1a1a1a', borderRadius: '16px 16px 0 0',
          width: '100%', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
          animation: 'slide-up 250ms cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--bg-elevated)' }} />
          </div>
          {header}
          {mode === 'create' ? createContent : listContent}
        </div>
        <style>{`@keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      </div>,
      document.body
    )
  }

  // Desktop: centered modal
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    }}>
      <div ref={ref} style={{
        background: '#1a1a1a', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)',
        width: '380px', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        animation: 'fade-up 200ms var(--ease) both',
      }}>
        {header}
        {mode === 'create' ? createContent : listContent}
      </div>
    </div>,
    document.body
  )
}
