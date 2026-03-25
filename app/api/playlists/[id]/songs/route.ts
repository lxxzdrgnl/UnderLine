import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

async function verifyOwnership(playlistId: string, userId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } })
  if (!playlist) return { error: Response.json(null, { status: 404 }) }
  if (playlist.userId !== userId) return { error: Response.json({ error: 'forbidden' }, { status: 403 }) }
  return { playlist }
}

// Helper: ensure default playlist exists
async function ensureDefaultPlaylist(userId: string) {
  const existing = await prisma.playlist.findFirst({
    where: { userId, isDefault: true },
  })
  if (existing) return existing

  try {
    return await prisma.playlist.create({
      data: { userId, name: '내 찜 목록', isDefault: true },
    })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return prisma.playlist.findFirst({ where: { userId, isDefault: true } })
    }
    throw e
  }
}

// GET — songs in playlist ordered by position
export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { id } = await params
  const check = await verifyOwnership(id, session.user.id)
  if ('error' in check) return check.error

  const songs = await prisma.playlistSong.findMany({
    where: { playlistId: id },
    orderBy: { position: 'asc' },
    include: {
      song: {
        select: {
          id: true, genius_id: true, title: true, artist: true,
          image_url: true, album: true,
        },
      },
    },
  })

  return Response.json(songs.map((ps) => ({
    playlistSongId: ps.id,
    songId: ps.songId,
    position: ps.position,
    addedAt: ps.addedAt,
    ...ps.song,
  })))
}

// POST — add song to playlist (idempotent)
export async function POST(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  let { id } = await params

  if (id === 'default') {
    const defaultPlaylist = await ensureDefaultPlaylist(session.user.id)
    if (!defaultPlaylist) return Response.json({ error: 'failed to create default playlist' }, { status: 500 })
    id = defaultPlaylist.id
  }

  const check = await verifyOwnership(id, session.user.id)
  if ('error' in check) return check.error

  const { songId } = await request.json()
  if (!songId) return Response.json({ error: 'songId required' }, { status: 400 })

  const existing = await prisma.playlistSong.findUnique({
    where: { playlistId_songId: { playlistId: id, songId } },
  })
  if (existing) return Response.json({ ok: true, alreadyExists: true })

  await prisma.$transaction(async (tx) => {
    const count = await tx.playlistSong.count({ where: { playlistId: id } })
    await tx.playlistSong.create({
      data: { playlistId: id, songId, position: count },
    })
  })

  return Response.json({ ok: true }, { status: 201 })
}
