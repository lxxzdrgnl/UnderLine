'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

interface SpotifyPlaylist {
  id: string
  name: string
  trackCount: number
  image_url: string | null
  isOwn: boolean
}

export function SpotifyImportModal({ onClose }: { onClose: () => void }) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SpotifyPlaylist | null>(null)
  const [name, setName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/spotify/playlists')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPlaylists(data)
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
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey) }
  }, [onClose])

  async function handleImport() {
    if (!selected) return
    setImporting(true)
    setError('')
    const res = await fetch('/api/playlists/import/spotify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spotifyPlaylistId: selected.id,
        name: name.trim() || selected.name,
      }),
    })
    setImporting(false)

    if (res.ok) {
      const data = await res.json()
      setResult({ imported: data.imported, skipped: data.skipped })
      setTimeout(() => {
        router.push(`/playlists/${data.playlistId}`)
        onClose()
      }, 1500)
    } else {
      const data = await res.json().catch(() => ({}))
      if (data.limitReached) setError('최대 50개까지 만들 수 있어요')
      else if (data.error === 'empty_playlist') setError(data.message || '트랙을 가져오지 못했어요')
      else setError(`가져오기 실패: ${data.error || res.status}`)
    }
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    }}>
      <div ref={ref} style={{
        background: '#242424',
        borderRadius: '12px',
        width: 'min(440px, 92vw)',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        animation: 'fade-up 250ms var(--ease) both',
        overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px',
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'linear-gradient(180deg, rgba(29,185,84,0.15) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {selected && !result && (
            <button
              onClick={() => { setSelected(null); setError('') }}
              style={{
                background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text)', fontSize: '16px', flexShrink: 0,
                transition: 'background 150ms',
              }}
            >
              ‹
            </button>
          )}
          {/* Spotify icon */}
          {!selected && (
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              background: '#1DB954', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#000">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: '16px', fontWeight: 700,
              color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {result ? '완료' : selected ? selected.name : 'Spotify에서 가져오기'}
            </h3>
            {selected && !result && (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-faint)' }}>
                {selected.trackCount}곡
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%',
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', flexShrink: 0,
              transition: 'background 150ms',
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div className="spinner" />
              <p style={{ fontSize: '13px', color: 'var(--text-faint)' }}>플레이리스트 불러오는 중...</p>
            </div>
          ) : result ? (
            <div style={{ textAlign: 'center', padding: '40px 24px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 16px',
                background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#000">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
              <p style={{ color: 'var(--text)', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
                가져오기 완료
              </p>
              <p style={{ color: 'var(--text-faint)', fontSize: '13px', margin: 0 }}>
                {result.imported}곡 저장 · {result.skipped}곡 건너뜀
              </p>
            </div>
          ) : !selected ? (
            <div style={{ padding: '4px 0' }}>
              {playlists.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => { if (p.isOwn) { setSelected(p); setName(p.name) } }}
                  disabled={!p.isOwn}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '8px 20px', width: '100%',
                    background: 'none', border: 'none',
                    cursor: p.isOwn ? 'pointer' : 'default',
                    textAlign: 'left',
                    opacity: p.isOwn ? 1 : 0.35,
                    transition: 'background 100ms',
                    animation: `fade-up 200ms var(--ease) ${idx * 25}ms both`,
                  }}
                  onMouseEnter={(e) => { if (p.isOwn) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '4px', flexShrink: 0,
                    background: '#333', overflow: 'hidden',
                  }}>
                    {p.image_url ? (
                      <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(135deg, #535353, #333)',
                        fontSize: '18px', color: 'var(--text-faint)',
                      }}>♪</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: '12px', color: 'var(--text-faint)' }}>
                      {p.isOwn ? `${p.trackCount}곡` : '다른 사용자'}
                    </p>
                  </div>
                  {p.isOwn && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--text-faint)" style={{ flexShrink: 0 }}>
                      <path d="M6 3l5 5-5 5z"/>
                    </svg>
                  )}
                </button>
              ))}
              {playlists.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>
                    Spotify 플레이리스트가 없어요
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px 24px' }}>
              {/* Selected playlist cover */}
              {selected.image_url && (
                <div style={{
                  width: '120px', height: '120px', margin: '0 auto 20px',
                  borderRadius: '4px', overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  <img src={selected.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                저장할 이름
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="플레이리스트 이름"
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

              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  width: '100%', padding: '14px', fontSize: '14px', fontWeight: 700,
                  background: '#1DB954', border: 'none',
                  borderRadius: '24px', color: '#000',
                  cursor: importing ? 'wait' : 'pointer',
                  letterSpacing: '0.02em',
                  transition: 'all 200ms',
                  opacity: importing ? 0.7 : 1,
                  transform: importing ? 'scale(0.98)' : 'scale(1)',
                }}
              >
                {importing ? '가져오는 중...' : '가져오기'}
              </button>
              {error && (
                <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#f15e6c', textAlign: 'center' }}>{error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
