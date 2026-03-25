'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

const MAX_LENGTH = 20

export function EditNameButton({ currentName }: { currentName: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const trimmed = name.trim()
  const overLimit = trimmed.length > MAX_LENGTH
  const unchanged = trimmed === currentName
  const canSave = trimmed.length > 0 && !overLimit && !unchanged && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    setSaving(false)
    if (res.ok) {
      setOpen(false)
      router.refresh()
    } else {
      setError('변경에 실패했어요')
    }
  }

  return (
    <>
      <button
        onClick={() => { setName(currentName); setError(''); setOpen(true) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-faint)', padding: '4px',
          display: 'inline-flex', alignItems: 'center',
          transition: 'color 150ms',
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
              width: 'min(400px, 90vw)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              animation: 'fade-up 250ms var(--ease) both',
              overflow: 'hidden',
            }}
          >
            {/* Header with gradient */}
            <div style={{
              padding: '32px 28px 20px',
              background: 'linear-gradient(180deg, rgba(80,80,80,0.3) 0%, transparent 100%)',
            }}>
              {/* Avatar placeholder */}
              <div style={{
                width: '100px', height: '100px', margin: '0 auto 16px',
                borderRadius: '50%', overflow: 'hidden',
                background: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '40px', fontWeight: 700, color: 'var(--text-faint)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}>
                {trimmed[0]?.toUpperCase() ?? currentName[0]?.toUpperCase() ?? '?'}
              </div>

              <h3 style={{
                margin: 0, fontSize: '20px', fontWeight: 700,
                color: 'var(--text)', textAlign: 'center',
              }}>
                닉네임 변경
              </h3>
            </div>

            {/* Input */}
            <div style={{ padding: '4px 28px 28px' }}>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  maxLength={MAX_LENGTH + 5}
                  autoFocus
                  placeholder="닉네임을 입력하세요"
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: '14px',
                    background: '#333',
                    border: `1px solid ${overLimit ? '#f15e6c' : '#555'}`,
                    borderRadius: '4px', color: 'var(--text)', outline: 'none',
                    transition: 'border-color 150ms',
                  }}
                  onFocus={(e) => { if (!overLimit) e.currentTarget.style.borderColor = '#fff' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = overLimit ? '#f15e6c' : '#555' }}
                />
              </div>

              {/* Counter + error */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '20px', minHeight: '18px',
              }}>
                <span style={{
                  fontSize: '12px',
                  color: overLimit ? '#f15e6c' : 'var(--text-faint)',
                }}>
                  {overLimit ? '20자 이내로 입력해주세요' : error || '\u00A0'}
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                  color: overLimit ? '#f15e6c' : trimmed.length > MAX_LENGTH - 5 ? 'var(--text-muted)' : 'var(--text-faint)',
                }}>
                  {trimmed.length}/{MAX_LENGTH}
                </span>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setOpen(false)}
                  disabled={saving}
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
                  onClick={handleSave}
                  disabled={!canSave}
                  style={{
                    padding: '12px 36px', fontSize: '14px', fontWeight: 700,
                    background: canSave ? '#1DB954' : '#333',
                    color: canSave ? '#000' : '#777',
                    border: 'none', borderRadius: '24px',
                    cursor: canSave ? 'pointer' : 'default',
                    letterSpacing: '0.02em',
                    transition: 'all 200ms',
                    transform: canSave ? 'scale(1)' : 'scale(0.98)',
                  }}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
