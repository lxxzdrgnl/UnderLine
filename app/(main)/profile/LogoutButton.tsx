'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="logout-btn"
      style={{
        display: 'block',
        width: '100%',
        padding: '12px',
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.02em',
        transition: 'background 150ms, color 150ms',
        textAlign: 'center',
      }}
    >
      로그아웃
    </button>
  )
}
