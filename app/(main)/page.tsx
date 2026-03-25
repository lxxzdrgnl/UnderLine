import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { HomeSearch } from '@/components/home/HomeSearch'

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
        fontFamily: 'var(--font-logo)',
        fontWeight: 'var(--font-logo-weight)' as unknown as number,
        letterSpacing: 'var(--font-logo-spacing)',
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

      <HomeSearch isLoggedIn={!!session?.user?.id} hasSpotify={hasSpotify} />

    </div>
  )
}
