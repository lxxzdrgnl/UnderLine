'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { SpotifyImportModal } from '@/components/playlist/SpotifyImportModal'

const MAX_PLAYLISTS = 50

export function PlaylistActions({ count, hasSpotify }: { count: number; hasSpotify: boolean }) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const atLimit = count >= MAX_PLAYLISTS

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setError('')
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setCreating(false)
    if (res.ok) {
      setShowCreate(false)
      setName('')
      router.refresh()
    } else {
      const data = await res.json()
      if (data.error === 'playlist_name_taken') setError('이미 같은 이름이 있어요')
      else if (data.limitReached) setError('최대 50개까지 만들 수 있어요')
    }
  }

  const btnBase: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    borderRadius: '20px',
    cursor: atLimit ? 'not-allowed' : 'pointer',
    opacity: atLimit ? 0.5 : 1,
    transition: 'all 150ms',
    lineHeight: '1.2',
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => !atLimit && setShowCreate(true)}
          disabled={atLimit}
          style={{
            ...btnBase,
            background: 'var(--text)',
            color: '#000',
            border: 'none',
          }}
        >
          + 만들기
        </button>

        {hasSpotify && (
          <button
            onClick={() => !atLimit && setShowImport(true)}
            disabled={atLimit}
            style={{
              ...btnBase,
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            Spotify
          </button>
        )}
      </div>

      {/* ── Create playlist modal ── */}
      {showCreate && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#242424',
              borderRadius: '12px',
              width: 'min(400px, 90vw)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              animation: 'fade-up 250ms var(--ease) both',
              overflow: 'hidden',
            }}
          >
            {/* Modal header with gradient */}
            <div style={{
              padding: '32px 28px 24px',
              background: 'linear-gradient(180deg, rgba(80,80,80,0.4) 0%, transparent 100%)',
            }}>
              {/* Placeholder cover */}
              <div style={{
                width: '140px', height: '140px', margin: '0 auto 20px',
                borderRadius: '4px', overflow: 'hidden',
                background: 'linear-gradient(135deg, #535353 0%, #333 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M20 14v20l14-10z" fill="rgba(255,255,255,0.3)"/>
                  <path d="M10 34h4v6h-4zM18 30h4v10h-4zM26 26h4v14h-4zM34 22h4v18h-4z" fill="rgba(255,255,255,0.15)"/>
                </svg>
              </div>

              <h3 style={{
                margin: '0 0 4px', fontSize: '22px', fontWeight: 700,
                color: 'var(--text)', textAlign: 'center',
              }}>
                새 플레이리스트
              </h3>
              <p style={{
                margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-faint)',
                textAlign: 'center',
              }}>
                이름을 지어주세요
              </p>
            </div>

            {/* Input area */}
            <div style={{ padding: '0 28px 28px' }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="내 플레이리스트"
                autoFocus
                style={{
                  width: '100%', padding: '12px 14px', fontSize: '14px',
                  background: '#333', border: '1px solid #555',
                  borderRadius: '4px', color: 'var(--text)', outline: 'none',
                  marginBottom: '20px',
                  transition: 'border-color 150ms',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#fff' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#555' }}
              />

              {error && (
                <p style={{ margin: '-8px 0 12px', fontSize: '12px', color: '#f15e6c' }}>{error}</p>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowCreate(false); setName(''); setError('') }}
                  disabled={creating}
                  style={{
                    padding: '12px 28px', fontSize: '14px', fontWeight: 700,
                    background: 'transparent', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    letterSpacing: '0.02em',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !name.trim()}
                  style={{
                    padding: '12px 36px', fontSize: '14px', fontWeight: 700,
                    background: name.trim() ? '#fff' : '#333',
                    color: name.trim() ? '#000' : '#777',
                    border: 'none', borderRadius: '24px',
                    cursor: name.trim() && !creating ? 'pointer' : 'default',
                    letterSpacing: '0.02em',
                    transition: 'all 200ms',
                    transform: name.trim() ? 'scale(1)' : 'scale(0.98)',
                  }}
                >
                  {creating ? '만드는 중...' : '만들기'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showImport && <SpotifyImportModal onClose={() => setShowImport(false)} />}
    </>
  )
}
