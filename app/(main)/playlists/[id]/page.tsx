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
        <h1 style={{
          margin: 0,
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 'var(--text-2xl)',
          fontWeight: 400,
          color: 'var(--text)',
        }}>
          {playlist.name}
        </h1>
        {!playlist.isDefault && (
          <DeletePlaylistButton playlistId={playlist.id} />
        )}
      </div>

      {songs.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '60px 0' }}>
          아직 저장된 곡이 없어요
        </p>
      ) : (
        <PlaylistSongList playlistId={playlist.id} initialSongs={songs} />
      )}
    </div>
  )
}
