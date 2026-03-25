import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { getNowPlaying } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession(req)
  if (error) return error

  const track = await getNowPlaying(session.user.id)
  return Response.json(track)
}
