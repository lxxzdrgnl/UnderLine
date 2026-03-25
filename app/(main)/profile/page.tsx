import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LinkedAccounts from './LinkedAccounts'
import LogoutButton from './LogoutButton'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 16px' }}>
      <h1
        style={{
          fontSize: 22,
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontWeight: 400,
          color: 'var(--text)',
          marginBottom: 32,
        }}
      >
        프로필
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
        {session.user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt="avatar"
            width={48}
            height={48}
            style={{ borderRadius: '50%' }}
          />
        )}
        <div>
          <p style={{ margin: 0, fontWeight: 500, color: 'var(--text)' }}>{session.user.name}</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{session.user.email}</p>
        </div>
      </div>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          연결된 소셜 계정
        </h2>
        <LinkedAccounts />
      </section>

      <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
        <LogoutButton />
      </div>
    </div>
  )
}
