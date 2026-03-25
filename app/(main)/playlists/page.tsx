import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlaylistActions } from './PlaylistActions'

export const dynamic = 'force-dynamic'

export default async function PlaylistsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const playlists = await prisma.playlist.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { songs: true } },
      songs: {
        take: 1,
        orderBy: { position: 'asc' },
        include: { song: { select: { image_url: true } } },
      },
    },
  })

  const hasSpotify = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'spotify' },
    select: { id: true },
  })

  const data = playlists.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.isDefault,
    songCount: p._count.songs,
    coverImage: p.songs[0]?.song.image_url ?? null,
  }))

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      <h1 style={{
        margin: '32px 0 28px',
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 'var(--text-2xl)',
        fontWeight: 400,
        color: 'var(--text)',
      }}>
        플레이리스트
      </h1>

      <PlaylistActions
        count={playlists.length}
        hasSpotify={!!hasSpotify}
      />

      {data.length === 0 && (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '60px 0' }}>
          찜한 곡이 없어요 — 노래 페이지에서 저장해보세요
        </p>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '16px',
        marginTop: '20px',
      }}>
        {data.map((p) => (
          <Link
            key={p.id}
            href={`/playlists/${p.id}`}
            className="hover-scale"
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--r-lg)',
              padding: '14px',
              textDecoration: 'none',
              transition: 'transform var(--dur)',
            }}
          >
            <div style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
              background: 'var(--bg-subtle)',
              marginBottom: '12px',
            }}>
              {p.coverImage && (
                <img src={p.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
              {p.songCount}곡
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
