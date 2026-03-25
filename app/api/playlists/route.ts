import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_PLAYLISTS = 50

// GET — list user's playlists with song count
// Auto-creates default "내 찜 목록" if user has no playlists yet
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  // Auto-create default playlist on first access
  const hasAny = await prisma.playlist.findFirst({ where: { userId: session.user.id }, select: { id: true } })
  if (!hasAny) {
    try {
      await prisma.playlist.create({ data: { userId: session.user.id, name: '내 찜 목록', isDefault: true } })
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== 'P2002') throw e
    }
  }

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

  return Response.json({
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      songCount: p._count.songs,
      coverImage: p.songs[0]?.song.image_url ?? null,
      createdAt: p.createdAt,
    })),
    count: playlists.length,
  })
}

// POST — create new playlist
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { name } = await request.json()
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const count = await prisma.playlist.count({ where: { userId: session.user.id } })
  if (count >= MAX_PLAYLISTS) {
    return Response.json({ error: 'playlist_limit_reached', limitReached: true }, { status: 422 })
  }

  try {
    const playlist = await prisma.playlist.create({
      data: { userId: session.user.id, name: name.trim() },
    })
    return Response.json(playlist, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return Response.json({ error: 'playlist_name_taken' }, { status: 422 })
    }
    throw e
  }
}
