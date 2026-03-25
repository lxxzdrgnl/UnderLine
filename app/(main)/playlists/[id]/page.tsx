import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlaylistSongList } from './PlaylistSongList'
import { DeletePlaylistButton } from './DeletePlaylistButton'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function PlaylistDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params
  const playlist = await prisma.playlist.findUnique({
    where: { id },
    include: {
      songs: {
        orderBy: { position: 'asc' },
        include: {
          song: {
            select: { id: true, genius_id: true, title: true, artist: true, image_url: true },
          },
        },
      },
    },
  })

  if (!playlist || playlist.userId !== session.user.id) notFound()

  const songs = playlist.songs.map((ps) => ({
    playlistSongId: ps.id,
    songId: ps.song.id,
    geniusId: ps.song.genius_id,
    title: ps.song.title,
    artist: ps.song.artist,
    imageUrl: ps.song.image_url,
    addedAt: ps.addedAt.toISOString(),
  }))

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '32px 0 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <a
          href="/playlists"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--bg-subtle)', color: 'var(--text-muted)',
            textDecoration: 'none', fontSize: '18px', flexShrink: 0,
            transition: 'background var(--dur)',
          }}
          className="hover-row"
        >
          ←
        </a>
        <h1 style={{
          margin: 0,
          fontSize: 'var(--text-2xl)',
          fontWeight: 400,
          color: 'var(--text)',
        }}>
          {playlist.name}
        </h1>
        </div>
        {!playlist.isDefault && (
          <DeletePlaylistButton playlistId={playlist.id} playlistName={playlist.name} />
        )}
      </div>

      {songs.length > 0 && (
        <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
          {songs.length}곡
        </p>
      )}

      {songs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)',
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)', margin: '0 0 4px' }}>
            아직 저장된 곡이 없어요
          </p>
          <p style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)', margin: 0 }}>
            노래 페이지에서 ♥를 눌러 저장해보세요
          </p>
        </div>
      ) : (
        <PlaylistSongList playlistId={playlist.id} initialSongs={songs} />
      )}
    </div>
  )
}
