'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

export function DeletePlaylistCardButton({ playlistId, playlistName }: { playlistId: string; playlistName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' })
    if (res.ok) { setOpen(false); router.refresh() }
    else setDeleting(false)
  }

  return (
    <>
      <button
        onClick={handleClick}
        style={{
          position: 'absolute', top: '8px', right: '8px',
          background: 'rgba(0,0,0,0.6)', border: 'none',
          borderRadius: '50%', width: '24px', height: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-faint)',
          fontSize: '12px', lineHeight: 1,
          opacity: 0, transition: 'opacity var(--dur)',
        }}
        title="삭제"
      >
        ✕
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
              color: 'var(--text)', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}>
              플레이리스트 삭제
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong>{playlistName}</strong>을(를) 삭제할까요?
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
