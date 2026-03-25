import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import type { PaginatedResponse } from '@/types'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const url = req.nextUrl
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? 20)))
  const skip = (page - 1) * size

  const [songs, total] = await Promise.all([
    prisma.song.findMany({
      skip,
      take: size,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        genius_id: true,
        title: true,
        artist: true,
        image_url: true,
        lyrics_status: true,
        created_at: true,
      },
    }),
    prisma.song.count(),
  ])

  const body: PaginatedResponse<(typeof songs)[0]> = {
    data: songs,
    pagination: { page, size, total, totalPages: Math.ceil(total / size) },
  }
  return NextResponse.json(body)
}
