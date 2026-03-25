import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import LinkedAccounts from './LinkedAccounts'
import LogoutButton from './LogoutButton'
import { EditNameButton } from './EditNameButton'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const songCount = await prisma.song.count()
  const playlistCount = await prisma.playlist.count({ where: { userId: session.user.id } })
  const historyCount = await prisma.searchHistory.count({ where: { userId: session.user.id } })

  return (
    <div className="page-enter" style={{ maxWidth: 640, margin: '0 auto', paddingBottom: '64px' }}>
      {/* ── Hero ── */}
      <div className="profile-hero" style={{
        display: 'flex', alignItems: 'flex-end', gap: '20px',
        padding: '48px 0 28px',
      }}>
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="profile-avatar"
            style={{
              width: '120px', height: '120px', borderRadius: '50%',
              objectFit: 'cover', flexShrink: 0,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          />
        ) : (
          <div className="profile-avatar" style={{
            width: '120px', height: '120px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '48px', fontWeight: 700, color: 'var(--text-faint)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {session.user.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--text-faint)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            프로필
          </p>
          <h1 style={{
            margin: 0,
            fontSize: 'clamp(24px, 5vw, 36px)',
            fontWeight: 700,
            color: 'var(--text)',
            lineHeight: 1.3,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.user.name}
            </span>
            <EditNameButton currentName={session.user.name ?? ''} />
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-faint)' }}>
            {session.user.email}
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{
        display: 'flex', padding: '0 0 28px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '28px',
      }}>
        {[
          { label: '플레이리스트', value: playlistCount },
          { label: '검색한 곡', value: historyCount },
          { label: '저장된 곡', value: songCount },
        ].map((stat, i) => (
          <div key={stat.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
              {stat.value}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-faint)' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Linked accounts ── */}
      <section style={{ marginBottom: '20px' }}>
        <h2 style={{
          fontSize: '12px', fontWeight: 700, color: 'var(--text-faint)',
          marginBottom: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          연결된 계정
        </h2>
        <LinkedAccounts />
      </section>

      {/* ── Logout ── */}
      <div style={{ paddingTop: '12px' }}>
        <LogoutButton />
      </div>
    </div>
  )
}
