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
        <p style={{ margin: '0 0 16px', fontSize: '13px', letterSpacing: '0.12em', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>
          AI Lyrics Interpreter
        </p>
        <h1
          style={{
            margin: '0 0 16px',
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            lineHeight: 1.1,
          }}
        >
          가사의 숨겨진 의미
        </h1>
        <p style={{ margin: 0, fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          슬랭, 문화적 맥락, 숨은 뜻까지 — 한 줄 한 줄 해석해드립니다
        </p>
      </div>

      <Suspense fallback={null}>
        <SearchBar isLoggedIn={!!session?.user?.id} />
      </Suspense>

      {hasSpotify && <NowPlaying />}

    </div>
  )
}
