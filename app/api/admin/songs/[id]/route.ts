import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'

export const DELETE = withAdmin(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const song = await prisma.song.findUnique({ where: { id } })
  if (!song) {
    return NextResponse.json(
      apiError(req.nextUrl.pathname, 404, 'SONG_NOT_FOUND'),
      { status: 404 }
    )
  }

  await prisma.song.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
})
