'use client'

import { signOut } from 'next-auth/react'

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 16px',
        borderRadius: 'var(--r-sm)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        cursor: 'pointer',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-muted)',
      }}
    >
      로그아웃
    </button>
  )
}
