import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'

export async function DELETE(
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

  await prisma.song.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
