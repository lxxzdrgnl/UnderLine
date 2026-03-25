'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SpotifyPlaylist {
  id: string
  name: string
  trackCount: number
  image_url: string | null
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
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
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
      const data = await res.json()
      if (data.limitReached) setError('최대 50개까지 만들 수 있어요')
      else setError('가져오기 실패')
    }
  }

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
        minWidth: '340px',
        maxWidth: '440px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{
          margin: '0 0 16px', fontSize: 'var(--text-md)',
          fontWeight: 600, color: 'var(--text)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          Spotify에서 가져오기
        </h3>

        {loading ? (
          <div className="spinner" style={{ margin: '32px auto' }} />
        ) : result ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--accent)', fontSize: 'var(--text-md)', fontWeight: 500 }}>
              가져오기 완료
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '8px 0 0' }}>
              {result.imported}곡 저장 · {result.skipped}곡 건너뜀
            </p>
          </div>
        ) : !selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setName(p.name) }}
                className="hover-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: 'var(--r-md)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                }}
              >
                {p.image_url && (
                  <img src={p.image_url} alt="" style={{ width: '40px', height: '40px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                    {p.trackCount}곡
                  </p>
                </div>
              </button>
            ))}
            {playlists.length === 0 && (
              <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '20px 0' }}>
                Spotify 플레이리스트가 없어요
              </p>
            )}
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              <strong>{selected.name}</strong> ({selected.trackCount}곡)
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="플레이리스트 이름"
              style={{
                width: '100%', padding: '10px 14px', fontSize: 'var(--text-sm)',
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', color: 'var(--text)', outline: 'none',
                marginBottom: '12px',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setSelected(null)}
                style={{
                  flex: 1, padding: '10px', fontSize: 'var(--text-sm)',
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                뒤로
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  flex: 1, padding: '10px', fontSize: 'var(--text-sm)',
                  background: 'var(--accent)', border: 'none',
                  borderRadius: 'var(--r-md)', color: '#000',
                  cursor: importing ? 'wait' : 'pointer', fontWeight: 500,
                }}
              >
                {importing ? '가져오는 중...' : '가져오기'}
              </button>
            </div>
            {error && (
              <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: '#e55' }}>{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
