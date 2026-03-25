import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string; songId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { id, songId } = await params

  const playlist = await prisma.playlist.findUnique({ where: { id } })
  if (!playlist) return Response.json(null, { status: 404 })
  if (playlist.userId !== session.user.id) return Response.json({ error: 'forbidden' }, { status: 403 })

  const entry = await prisma.playlistSong.findUnique({
    where: { playlistId_songId: { playlistId: id, songId } },
  })
  if (!entry) return Response.json(null, { status: 404 })

  await prisma.playlistSong.delete({ where: { id: entry.id } })
  return Response.json({ ok: true })
}
