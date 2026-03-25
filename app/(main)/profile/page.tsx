import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import LinkedAccounts from './LinkedAccounts'
import LogoutButton from './LogoutButton'
import { EditNameButton } from './EditNameButton'
import { ProfileAvatar } from './ProfileAvatar'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const songCount = await prisma.playlistSong.findMany({
    where: { playlist: { userId: session.user.id } },
    select: { songId: true },
    distinct: ['songId'],
  }).then((r) => r.length)
  const playlistCount = await prisma.playlist.count({ where: { userId: session.user.id } })
  const historyCount = await prisma.searchHistory.count({ where: { userId: session.user.id } })

  return (
    <div className="page-enter" style={{ maxWidth: 640, margin: '0 auto', paddingBottom: '64px' }}>
      {/* ── Hero ── */}
      <div className="profile-hero" style={{
        display: 'flex', alignItems: 'flex-end', gap: '20px',
        padding: '48px 0 28px',
      }}>
        <ProfileAvatar
          currentImage={session.user.image ?? null}
          name={session.user.name ?? ''}
        />
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
            <EditNameButton currentName={session.user.name ?? ''} currentImage={session.user.image ?? null} />
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
          { label: '플레이리스트', value: playlistCount, href: '/playlists' },
          { label: '검색한 곡', value: historyCount, href: '/recents' },
          { label: '저장된 곡', value: songCount, href: '/playlists' },
        ].map((stat, i) => (
          <Link
            key={stat.label}
            href={stat.href}
            style={{
              flex: 1, textAlign: 'center',
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              textDecoration: 'none',
              padding: '4px 0',
              borderRadius: '4px',
              transition: 'opacity 150ms',
            }}
            className="profile-stat-link"
          >
            <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
              {stat.value}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-faint)' }}>
              {stat.label}
            </p>
          </Link>
        ))}
      </div>

      {/* ── Linked accounts ── */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '12px', fontWeight: 700, color: 'var(--text-faint)',
          marginBottom: '12px', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          연결된 계정
        </h2>
        <LinkedAccounts />
      </section>

      {/* ── Logout ── */}
      <LogoutButton />
    </div>
  )
}
