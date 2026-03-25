'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      style={{
        padding: '10px 24px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'transparent',
        color: 'var(--text)',
        letterSpacing: '0.02em',
        transition: 'all 150ms',
      }}
    >
      로그아웃
    </button>
  )
}
