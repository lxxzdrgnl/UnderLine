import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlaylistActions } from './PlaylistActions'
import { DeletePlaylistCardButton } from './DeletePlaylistCardButton'

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
        take: 4,
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
    coverImages: p.songs.map((s) => s.song.image_url).filter(Boolean) as string[],
  }))

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        margin: '32px 0 24px', gap: '16px', flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            라이브러리
          </p>
          <h1 style={{
            margin: 0,
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 'var(--text-2xl)',
            fontWeight: 400,
            color: 'var(--text)',
          }}>
            플레이리스트
          </h1>
        </div>
        <PlaylistActions count={playlists.length} hasSpotify={!!hasSpotify} />
      </div>

      {data.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          background: 'var(--bg-surface)', borderRadius: 'var(--r-xl)',
        }}>
          <p style={{ fontSize: '32px', margin: '0 0 12px' }}>♪</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', margin: '0 0 4px' }}>
            아직 플레이리스트가 없어요
          </p>
          <p style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)', margin: 0 }}>
            노래 페이지에서 ♥를 눌러 저장해보세요
          </p>
        </div>
      )}

      <div className="playlist-grid" style={{ display: 'grid', gap: '12px' }}>
        {data.map((p, idx) => (
          <div
            key={p.id}
            className="playlist-card"
            style={{
              position: 'relative',
              animation: `fade-up 350ms var(--ease) ${idx * 40}ms both`,
            }}
          >
            <Link
              href={`/playlists/${p.id}`}
              className="playlist-card-link"
              style={{
                display: 'block',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--r-lg)',
                padding: '12px',
                textDecoration: 'none',
                transition: 'background 200ms, transform 200ms var(--ease)',
              }}
            >
              {/* Cover — mosaic if 4 images, single if 1, gradient if 0 */}
              <div style={{
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: 'var(--r-md)',
                overflow: 'hidden',
                background: 'var(--bg-subtle)',
                marginBottom: '10px',
                position: 'relative',
              }}>
                {p.coverImages.length >= 4 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', height: '100%' }}>
                    {p.coverImages.slice(0, 4).map((url, i) => (
                      <img key={i} src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ))}
                  </div>
                ) : p.coverImages.length > 0 ? (
                  <img src={p.coverImages[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: p.isDefault
                      ? 'linear-gradient(135deg, #1DB954 0%, #191414 100%)'
                      : 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-subtle) 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '28px', color: 'var(--text-faint)',
                  }}>
                    {p.isDefault ? '♥' : '♪'}
                  </div>
                )}

              </div>

              <p style={{
                margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500,
                color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.name}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                {p.songCount}곡
              </p>
            </Link>
            {!p.isDefault && <DeletePlaylistCardButton playlistId={p.id} playlistName={p.name} />}
          </div>
        ))}
      </div>
    </div>
  )
}
