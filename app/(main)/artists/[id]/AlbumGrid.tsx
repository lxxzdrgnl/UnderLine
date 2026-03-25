'use client'

import { useState } from 'react'
import Link from 'next/link'

type AlbumItem = {
  id: string
  name: string
  image_url: string | null
  release_date: string | null
  href: string
}

const INITIAL_COUNT = 4

export function AlbumGrid({ albums }: { albums: AlbumItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? albums : albums.slice(0, INITIAL_COUNT)
  const hasMore = albums.length > INITIAL_COUNT

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '20px',
      }}>
        {visible.map((album) => (
          <Link
            key={album.id}
            href={album.href}
            style={{ textDecoration: 'none', transition: 'opacity 150ms' }}
            className="hover-dim"
          >
            <div style={{
              width: '100%', aspectRatio: '1', borderRadius: 'var(--r-md)',
              overflow: 'hidden', background: 'var(--bg-subtle)', marginBottom: '10px',
            }}>
              {album.image_url ? (
                <img src={album.image_url} alt={album.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '24px' }}>♪</div>
              )}
            </div>
            <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {album.name}
            </p>
            {album.release_date && (
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                {album.release_date}
              </p>
            )}
          </Link>
        ))}
      </div>
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: 'block', margin: '16px auto 0', padding: '8px 20px',
            fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-muted)',
            background: 'var(--bg-subtle)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'all 150ms',
          }}
          className="hover-row"
        >
          {albums.length - INITIAL_COUNT}개 더 보기
        </button>
      )}
    </>
  )
}
