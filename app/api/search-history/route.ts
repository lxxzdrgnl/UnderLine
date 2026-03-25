import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/search-history — 최근 10개
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json([], { status: 200 })

  const rows = await prisma.searchHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { created_at: 'desc' },
    take: 10,
    select: { id: true, genius_id: true, title: true, artist: true, image_url: true },
  })
  return Response.json(rows)
}

// POST /api/search-history — upsert (중복이면 created_at 갱신해서 상단으로)
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { genius_id, title, artist, image_url } = await request.json()
  if (!genius_id) return Response.json({ error: 'genius_id required' }, { status: 400 })

  await prisma.searchHistory.upsert({
    where: { userId_genius_id: { userId: session.user.id, genius_id } },
    create: { userId: session.user.id, genius_id, title, artist, image_url: image_url ?? null },
    update: { created_at: new Date(), title, artist, image_url: image_url ?? null },
  })
  return Response.json({ ok: true })
}

// DELETE /api/search-history?genius_id=xxx
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const genius_id = request.nextUrl.searchParams.get('genius_id')
  if (!genius_id) return Response.json({ error: 'genius_id required' }, { status: 400 })

  await prisma.searchHistory.deleteMany({
    where: { userId: session.user.id, genius_id },
  })
  return Response.json({ ok: true })
}
