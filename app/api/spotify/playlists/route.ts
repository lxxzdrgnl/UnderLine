import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { getSpotifyPlaylists } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession(req)
  if (error) return error

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'spotify' },
    select: { id: true, scope: true },
  })
  if (!account) {
    return Response.json({ error: 'spotify_not_linked' }, { status: 403 })
  }

  const playlists = await getSpotifyPlaylists(session.user.id)
  return Response.json(playlists)
}
