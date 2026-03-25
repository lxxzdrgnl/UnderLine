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
    <div className="home-wrap" style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0',
    }}>

      {/* Radial glow */}
      <div aria-hidden style={{
        position: 'absolute',
        top: '0',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '300px',
        background: 'radial-gradient(ellipse at center, rgba(29,185,84,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Brand mark */}
      <h1 className="home-brand" style={{
        margin: '0 0 10px',
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontWeight: 400,
        letterSpacing: '-0.03em',
        color: 'var(--text)',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fade-up 600ms var(--ease) 100ms both',
      }}>
        under
        <span aria-hidden style={{
          display: 'inline-block',
          height: '4px',
          background: 'var(--accent)',
          margin: '0 4px 8px',
          borderRadius: '2px',
          flexShrink: 0,
          animation: 'dash-in 500ms var(--ease) 500ms both',
        }} />
        line
      </h1>

      {/* Tagline — sits flush under brand mark */}
      <p style={{
        margin: '0 0 48px',
        fontSize: '14px',
        color: 'var(--text-faint)',
        letterSpacing: '0.04em',
        animation: 'fade-up 600ms var(--ease) 200ms both',
      }}>
        가사의 숨겨진 의미를 한 줄 한 줄 찾아보세요
      </p>

      {/* Search */}
      <div style={{
        width: '100%',
        maxWidth: '560px',
        animation: 'fade-up 600ms var(--ease) 300ms both',
      }}>
        <Suspense fallback={null}>
          <SearchBar isLoggedIn={!!session?.user?.id} />
        </Suspense>
      </div>

      {/* Now Playing */}
      {hasSpotify && (
        <div style={{
          marginTop: '40px',
          width: '100%',
          maxWidth: '560px',
          animation: 'fade-up 600ms var(--ease) 400ms both',
        }}>
          <NowPlaying />
        </div>
      )}
    </div>
  )
}
