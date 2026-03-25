import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/search-history?cursor=xxx&limit=20
export async function GET(request: NextRequest) {
  const { session, error } = await requireSession(request)
  if (error) return error

  const cursor = request.nextUrl.searchParams.get('cursor')
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 20, 50)

  const rows = await prisma.searchHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: { id: true, genius_id: true, title: true, artist: true, image_url: true, updatedAt: true },
  })

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1].id : null

  return Response.json({ items, nextCursor })
}

// POST /api/search-history — upsert (중복이면 created_at 갱신해서 상단으로)
export async function POST(request: NextRequest) {
  const { session, error } = await requireSession(request)
  if (error) return error

  const { genius_id, title, artist, image_url } = await request.json()
  if (!genius_id) return Response.json({ error: 'genius_id required' }, { status: 400 })

  await prisma.searchHistory.upsert({
    where: { userId_genius_id: { userId: session.user.id, genius_id } },
    create: { userId: session.user.id, genius_id, title, artist, image_url: image_url ?? null },
    update: { title, artist, image_url: image_url ?? null },
  })
  return Response.json({ ok: true })
}

// DELETE /api/search-history?genius_id=xxx
export async function DELETE(request: NextRequest) {
  const { session, error } = await requireSession(request)
  if (error) return error

  const genius_id = request.nextUrl.searchParams.get('genius_id')
  if (!genius_id) return Response.json({ error: 'genius_id required' }, { status: 400 })

  await prisma.searchHistory.deleteMany({
    where: { userId: session.user.id, genius_id },
  })
  return Response.json({ ok: true })
}
