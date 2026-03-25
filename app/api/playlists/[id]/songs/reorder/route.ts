import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(request)
  if (error) return error

  const { id } = await params

  const playlist = await prisma.playlist.findUnique({ where: { id } })
  if (!playlist) return Response.json(null, { status: 404 })
  if (playlist.userId !== session.user.id) return Response.json({ error: 'forbidden' }, { status: 403 })

  const { order } = await request.json() as { order: string[] }
  if (!Array.isArray(order)) return Response.json({ error: 'order must be an array' }, { status: 400 })

  const existing = await prisma.playlistSong.findMany({
    where: { playlistId: id },
    select: { songId: true },
  })
  const existingIds = new Set(existing.map((e) => e.songId))

  if (order.length !== existingIds.size) {
    return Response.json({ error: 'order length must match playlist song count' }, { status: 422 })
  }
  for (const songId of order) {
    if (!existingIds.has(songId)) {
      return Response.json({ error: `songId ${songId} not in playlist` }, { status: 422 })
    }
  }

  await prisma.$transaction(
    order.map((songId, i) =>
      prisma.playlistSong.update({
        where: { playlistId_songId: { playlistId: id, songId } },
        data: { position: i },
      })
    )
  )

  return Response.json({ ok: true })
}
