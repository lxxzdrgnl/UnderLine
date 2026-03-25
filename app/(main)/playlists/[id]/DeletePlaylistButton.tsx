'use client'

import { useRouter } from 'next/navigation'

export function DeletePlaylistButton({ playlistId }: { playlistId: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('플레이리스트를 삭제할까요?')) return
    const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' })
    if (res.ok) router.replace('/playlists')
  }

  return (
    <button
      onClick={handleDelete}
      style={{
        padding: '6px 14px',
        fontSize: 'var(--text-xs)',
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        color: 'var(--text-faint)',
        cursor: 'pointer',
      }}
      className="hover-row"
    >
      삭제
    </button>
  )
}
