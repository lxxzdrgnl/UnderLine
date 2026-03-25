'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

interface Props {
  song: { genius_id: string; title: string; artist: string; image_url: string | null }
  className?: string
  style?: React.CSSProperties
  children: ReactNode
}

export function SongLink({ song, className, style, children }: Props) {
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    fetch('/api/user/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        genius_id: song.genius_id,
        title: song.title,
        artist: song.artist,
        image_url: song.image_url,
      }),
    }).catch(() => {})
    router.push(`/songs/${song.genius_id}`)
  }

  return (
    <a
      href={`/songs/${song.genius_id}`}
      onClick={handleClick}
      className={className}
      style={style}
    >
      {children}
    </a>
  )
}
