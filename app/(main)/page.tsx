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
        gap: '56px',
        padding: '100px 0 80px',
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: '560px' }}>
        <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
          가사의 숨겨진 의미
        </p>
        <h1
          style={{
            margin: '0 0 20px',
            fontSize: 'clamp(40px, 6vw, 64px)',
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontWeight: 400,
            letterSpacing: '-0.03em',
            color: 'var(--text)',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0',
          }}
        >
          under
          <span style={{
            display: 'inline-block',
            width: 'clamp(20px, 3vw, 32px)',
            height: '3px',
            background: 'var(--accent)',
            margin: '0 3px 6px',
            borderRadius: '2px',
            flexShrink: 0,
          }} />
          line
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
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
