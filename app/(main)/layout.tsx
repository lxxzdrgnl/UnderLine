import Link from 'next/link'
import { auth } from '@/lib/auth'
import { UserDropdown } from '@/components/nav/UserDropdown'

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
          background: 'rgba(18, 18, 18, 0.92)',
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
            href="/search"
            style={{
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: 'var(--text-sm)',
            }}
            className="hover-dim"
          >
            검색
          </Link>
          {session ? (
            <UserDropdown user={{ image: session.user?.image, name: session.user?.name }} />
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

      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '24px 32px',
          marginTop: '48px',
        }}
      >
        <div
          style={{
            maxWidth: '1160px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
            © 2026 under-line. Lyrics and annotations sourced from Genius.
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', opacity: 0.6, textAlign: 'center' }}>
            Not affiliated with Genius, Spotify, or any music rights holders.
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <a
              href="https://www.instagram.com/lxxzdrgnl"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-faint)', display: 'flex', opacity: 0.5 }}
              className="hover-dim"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
            <a
              href="https://github.com/lxxzdrgnl"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-faint)', display: 'flex', opacity: 0.5 }}
              className="hover-dim"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
