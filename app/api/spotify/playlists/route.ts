import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSpotifyPlaylists } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'spotify' },
    select: { id: true },
  })
  if (!account) {
    return Response.json({ error: 'spotify_not_linked' }, { status: 403 })
  }

  const playlists = await getSpotifyPlaylists(session.user.id)
  return Response.json(playlists)
}
