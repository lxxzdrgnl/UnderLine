'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

type Option = {
  type: string
  label: string
  image: string | null
}

type Props = {
  currentImage: string | null
  name: string
}

export function ProfileAvatar({ currentImage, name }: Props) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<Option[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function openSelector() {
    setOpen(true)
    setLoadingOptions(true)
    try {
      const res = await fetch('/api/user/accounts')
      const data = await res.json()
      const providerOptions: Option[] = (data.providers ?? [])
        .filter((p: { provider: string; image: string | null }) => p.image)
        .map((p: { provider: string; image: string }) => ({
          type: p.provider,
          label: p.provider === 'google' ? 'Google' : 'Spotify',
          image: p.image,
        }))
      setOptions([...providerOptions, { type: 'initial', label: '이니셜', image: null }])
    } catch {
      setOptions([{ type: 'initial', label: '이니셜', image: null }])
    } finally {
      setLoadingOptions(false)
    }
  }

  const initial = name?.[0]?.toUpperCase() ?? '?'

  async function handleSelect(image: string | null) {
    setSaving(true)
    await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={openSelector}
        style={{
          position: 'relative', width: '120px', height: '120px',
          borderRadius: '50%', flexShrink: 0, background: 'none',
          border: 'none', padding: 0, cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
        className="profile-avatar-btn"
      >
        {currentImage ? (
          <img
            src={currentImage} alt=""
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '48px', fontWeight: 700, color: 'var(--text-faint)',
          }}>
            {initial}
          </div>
        )}
        {/* Edit overlay */}
        <div className="profile-avatar-overlay" style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '4px', opacity: 0, transition: 'opacity 150ms',
          pointerEvents: 'none',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/>
          </svg>
          <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>변경</span>
        </div>
      </button>

      {open && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={() => !saving && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#242424', borderRadius: '16px',
              width: 'min(420px, 92vw)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              animation: 'fade-up 250ms var(--ease) both',
              padding: '28px',
            }}
          >
            <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>
              프로필 이미지 선택
            </h3>

            {loadingOptions ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <div className="spinner" />
              </div>
            ) : (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {options.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleSelect(opt.image)}
                  disabled={saving}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                    background: 'none', border: '2px solid transparent',
                    borderRadius: '12px', padding: '12px',
                    cursor: saving ? 'default' : 'pointer',
                    transition: 'border-color 150ms, background 150ms',
                    opacity: saving ? 0.6 : 1,
                  }}
                  className="avatar-option-btn"
                >
                  {opt.image ? (
                    <img
                      src={opt.image} alt=""
                      style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '80px', height: '80px', borderRadius: '50%',
                      background: 'var(--bg-elevated)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '32px', fontWeight: 700, color: 'var(--text-faint)',
                    }}>
                      {initial}
                    </div>
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
