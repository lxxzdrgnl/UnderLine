import { Suspense } from 'react'
import { SearchBar } from '@/components/search/SearchBar'
import { NowPlaying } from '@/components/song/NowPlaying'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function HomePage() {
  const session = await auth()
  const hasSpotify = session?.user?.id
    ? !!(await prisma.account.findFirst({
        where: { userId: session.user.id, provider: 'spotify' },
        select: { id: true },
      }))
    : false

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '48px',
        padding: '80px 0',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            margin: '0 0 12px',
            fontSize: 'clamp(28px, 5vw, 44px)',
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            lineHeight: 1.15,
          }}
        >
          가사의 숨겨진 의미
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '15px',
            color: 'var(--text-muted)',
          }}
        >
          한 줄 한 줄, 진짜 의미를 찾아보세요
        </p>
      </div>
      <Suspense fallback={null}>
        <SearchBar isLoggedIn={!!session?.user?.id} />
      </Suspense>
      {hasSpotify && <NowPlaying />}
    </div>
  )
}
