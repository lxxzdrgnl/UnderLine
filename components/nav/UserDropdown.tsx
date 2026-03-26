'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useModalDismiss } from '@/hooks/useModalDismiss'

interface Props {
  user: { image?: string | null; name?: string | null }
}

const menuItems = [
  { label: '최근 검색', href: '/recents', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  )},
  { label: '플레이리스트', href: '/playlists', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  )},
  { label: '설정', href: '/profile', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )},
]

export function UserDropdown({ user }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useModalDismiss(ref, () => setOpen(false), open)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="nav-icon-btn"
        style={{
          background: open ? 'rgba(255,255,255,0.1)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          transition: 'background 150ms',
        }}
      >
        {user.image ? (
          <img
            src={user.image}
            alt=""
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-faint)',
            }}
          >
            {user.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            background: '#282828',
            borderRadius: '8px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            minWidth: '200px',
            padding: '4px',
            zIndex: 60,
            transformOrigin: 'top right',
            animation: 'dropdown-in 120ms var(--ease) both',
          }}
        >
          {/* User info */}
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
              {user.name ?? '사용자'}
            </p>
          </div>

          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="nav-dropdown-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                borderRadius: '4px',
                transition: 'background 80ms, color 80ms',
              }}
            >
              <span style={{ display: 'flex', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
