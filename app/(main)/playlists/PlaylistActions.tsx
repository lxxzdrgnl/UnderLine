'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SpotifyImportModal } from '@/components/playlist/SpotifyImportModal'

const MAX_PLAYLISTS = 50

export function PlaylistActions({ count, hasSpotify }: { count: number; hasSpotify: boolean }) {
  const router = useRouter()
  const [showInput, setShowInput] = useState(false)
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
      setShowInput(false)
      setName('')
      router.refresh()
    } else {
      const data = await res.json()
      if (data.error === 'playlist_name_taken') setError('이미 같은 이름이 있어요')
      else if (data.limitReached) setError('최대 50개까지 만들 수 있어요')
    }
  }

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
      {!showInput ? (
        <button
          onClick={() => !atLimit && setShowInput(true)}
          disabled={atLimit}
          style={{
            padding: '8px 18px',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            borderRadius: '20px',
            border: 'none',
            cursor: atLimit ? 'not-allowed' : 'pointer',
            background: atLimit ? 'var(--bg-subtle)' : 'var(--accent)',
            color: atLimit ? 'var(--text-faint)' : '#000',
            opacity: atLimit ? 0.6 : 1,
          }}
        >
          새 플레이리스트
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="이름 입력"
            autoFocus
            style={{
              padding: '8px 14px',
              fontSize: 'var(--text-sm)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: '8px 14px',
              fontSize: 'var(--text-sm)',
              borderRadius: 'var(--r-md)',
              border: 'none',
              cursor: 'pointer',
              background: 'var(--accent)',
              color: '#000',
              fontWeight: 500,
            }}
          >
            {creating ? '...' : '만들기'}
          </button>
          <button
            onClick={() => { setShowInput(false); setName(''); setError('') }}
            style={{
              padding: '8px',
              fontSize: 'var(--text-sm)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-faint)',
            }}
          >
            취소
          </button>
        </div>
      )}

      {atLimit && !showInput && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
          최대 50개까지 만들 수 있어요
        </span>
      )}

      {error && (
        <span style={{ fontSize: 'var(--text-xs)', color: '#e55' }}>{error}</span>
      )}

      {hasSpotify && (
        <button
          onClick={() => !atLimit && setShowImport(true)}
          disabled={atLimit}
          style={{
            padding: '8px 18px',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            borderRadius: '20px',
            border: '1px solid var(--border)',
            cursor: atLimit ? 'not-allowed' : 'pointer',
            background: 'transparent',
            color: 'var(--text-muted)',
            opacity: atLimit ? 0.5 : 1,
          }}
        >
          Spotify에서 가져오기
        </button>
      )}

      {showImport && <SpotifyImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
