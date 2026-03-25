import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const { id } = await params
  const song = await prisma.song.findUnique({ where: { id } })
  if (!song) {
    return NextResponse.json(
      apiError(req.nextUrl.pathname, 404, 'SONG_NOT_FOUND'),
      { status: 404 }
    )
  }

  await prisma.song.update({
    where: { id },
    data: { lyrics_status: 'NONE', locked_at: null, generation_id: null },
  })

  return NextResponse.json({ message: 'reset' })
}
