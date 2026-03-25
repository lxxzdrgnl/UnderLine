import Link from 'next/link'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          height: '56px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(10, 10, 10, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: '16px',
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            fontWeight: 500,
          }}
        >
          under
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '2px',
              background: 'var(--accent)',
              margin: '0 2px 3px',
              flexShrink: 0,
              borderRadius: '1px',
            }}
          />
          line
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: 'var(--text-sm)' }}>
          <Link
            href="/docs"
            style={{ color: 'var(--text-faint)', textDecoration: 'none' }}
            className="hover-dim"
          >
            API
          </Link>

          {session ? (
            <Link href="/profile" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt=""
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: '1px solid var(--border-strong)',
                  }}
                />
              )}
            </Link>
          ) : (
            <Link
              href="/login"
              style={{
                padding: '6px 16px',
                background: 'var(--accent)',
                color: '#000',
                borderRadius: '20px',
                textDecoration: 'none',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                letterSpacing: '0.01em',
              }}
              className="hover-dim"
            >
              로그인
            </Link>
          )}
        </nav>
      </header>

      <main
        style={{
          flex: 1,
          maxWidth: '1160px',
          width: '100%',
          margin: '0 auto',
          padding: '0 28px',
        }}
      >
        {children}
      </main>
    </div>
  )
}
