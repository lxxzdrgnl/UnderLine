'use client'

import { useState, Suspense } from 'react'
import { SearchBar } from '@/components/search/SearchBar'
import { NowPlaying } from '@/components/song/NowPlaying'

interface Props {
  isLoggedIn: boolean
  hasSpotify: boolean
}

export function HomeSearch({ isLoggedIn, hasSpotify }: Props) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        animation: 'fade-up 600ms var(--ease) 300ms both',
      }}>
        <Suspense fallback={null}>
          <SearchBar isLoggedIn={isLoggedIn} onOpenChange={setSearchOpen} />
        </Suspense>
      </div>

      {hasSpotify && (
        <div style={{ marginTop: '40px', width: '100%', maxWidth: '560px', animation: 'fade-up 600ms var(--ease) 400ms both' }}>
          <div style={{
            opacity: searchOpen ? 0 : 1,
            transform: searchOpen ? 'translateY(4px)' : 'translateY(0)',
            transition: 'opacity 120ms, transform 120ms',
            pointerEvents: searchOpen ? 'none' : 'auto',
          }}>
            <NowPlaying isLoggedIn={isLoggedIn} />
          </div>
        </div>
      )}
    </>
  )
}
