'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

export function EditNameButton({ currentName }: { currentName: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSave() {
    if (!name.trim() || name.trim() === currentName) { setOpen(false); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      setOpen(false)
      router.refresh()
    } else {
      setError('변경 실패')
    }
  }

  return (
    <>
      <button
        onClick={() => { setName(currentName); setOpen(true) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-faint)', fontSize: '14px', padding: '4px',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}
        title="닉네임 변경"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.5 1.5a1.41 1.41 0 012 2L5 12l-3 1 1-3z"/>
        </svg>
      </button>

      {open && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={() => !saving && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#242424', borderRadius: '12px',
              width: 'min(380px, 90vw)', padding: '28px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              animation: 'fade-up 250ms var(--ease) both',
            }}
          >
            <h3 style={{
              margin: '0 0 20px', fontSize: '18px', fontWeight: 700,
              color: 'var(--text)',
            }}>
              닉네임 변경
            </h3>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
              이름
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', fontSize: '14px',
                background: '#333', border: '1px solid #555',
                borderRadius: '4px', color: 'var(--text)', outline: 'none',
                marginBottom: '20px',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#fff' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#555' }}
            />
            {error && <p style={{ margin: '-8px 0 12px', fontSize: '12px', color: '#f15e6c' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                style={{
                  padding: '12px 28px', fontSize: '14px', fontWeight: 700,
                  background: 'transparent', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                style={{
                  padding: '12px 36px', fontSize: '14px', fontWeight: 700,
                  background: name.trim() ? '#fff' : '#333',
                  color: name.trim() ? '#000' : '#777',
                  border: 'none', borderRadius: '24px',
                  cursor: name.trim() && !saving ? 'pointer' : 'default',
                }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
