'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

export function DeletePlaylistButton({ playlistId, playlistName }: { playlistId: string; playlistName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' })
    if (res.ok) router.replace('/playlists')
    else setDeleting(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
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

      {open && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          }}
          onClick={() => !deleting && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a1a',
              borderRadius: 'var(--r-xl)',
              border: '1px solid var(--border)',
              padding: '24px',
              width: 'min(340px, 85vw)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              animation: 'fade-up 200ms var(--ease) both',
            }}
          >
            <h3 style={{
              margin: '0 0 8px', fontSize: '15px', fontWeight: 600,
            }}>
              플레이리스트 삭제
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong>{playlistName}</strong>을(를) 삭제할까요? 이 작업은 되돌릴 수 없어요.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
                style={{
                  padding: '10px 18px', fontSize: 'var(--text-sm)',
                  background: 'var(--bg-subtle)', border: 'none',
                  borderRadius: 'var(--r-md)', color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '10px 18px', fontSize: 'var(--text-sm)', fontWeight: 600,
                  background: '#e55', border: 'none',
                  borderRadius: 'var(--r-md)', color: '#fff',
                  cursor: deleting ? 'wait' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
