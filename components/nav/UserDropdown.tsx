'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface Props {
  user: { image?: string | null; name?: string | null }
}

const menuItems = [
  { label: 'Recents', href: '/recents' },
  { label: '플레이리스트', href: '/playlists' },
  { label: '설정', href: '/profile' },
]

export function UserDropdown({ user }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {user.image ? (
          <img
            src={user.image}
            alt=""
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1px solid var(--border-strong)',
            }}
          />
        ) : (
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-strong)',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            minWidth: '180px',
            padding: '6px 0',
            zIndex: 60,
          }}
        >
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '10px 16px',
                fontSize: 'var(--text-sm)',
                color: 'var(--text)',
                textDecoration: 'none',
                transition: 'background var(--dur)',
              }}
              className="hover-row"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
