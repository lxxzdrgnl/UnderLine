import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

// GET — which of my playlists contain this song?
export async function GET(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req)
  if (error) return error

  const { id } = await params

  // id could be CUID or genius_id — resolve to Song.id
  let songId = id
  const song = await prisma.song.findFirst({
    where: { OR: [{ id }, { genius_id: id }] },
    select: { id: true },
  })
  if (song) songId = song.id

  const entries = await prisma.playlistSong.findMany({
    where: {
      songId,
      playlist: { userId: session.user.id },
    },
    select: { playlistId: true },
  })

  return Response.json({ playlistIds: entries.map((e) => e.playlistId) })
}
