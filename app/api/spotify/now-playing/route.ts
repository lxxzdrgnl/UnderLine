import { auth } from '@/lib/auth'
import { getNowPlaying } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json(null, { status: 401 })
  }

  const track = await getNowPlaying(session.user.id)
  return Response.json(track)
}
