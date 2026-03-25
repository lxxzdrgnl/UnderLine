/**
 * @swagger
 * /api/songs/search:
 *   get:
 *     summary: 곡 검색 (Genius API)
 *     tags: [Songs]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: 검색 키워드
 *     responses:
 *       200:
 *         description: 검색 결과 목록
 */
import { NextRequest } from 'next/server'
import { searchSongs } from '@/lib/genius'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 메모리 캐시 (60초 TTL)
const cache = new Map<string, { data: unknown; expires: number }>()

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return Response.json({ results: [] })

  // 캐시 확인
  const cached = cache.get(q)
  if (cached && cached.expires > Date.now()) {
    return Response.json({ results: cached.data })
  }

  try {
    const geniusResults = await searchSongs(q)
    const geniusIds = geniusResults.map((r) => r.genius_id)

    const cachedSongs = await prisma.song.findMany({
      where: { genius_id: { in: geniusIds } },
      select: { genius_id: true, id: true, lyrics_status: true },
    })
    const cacheMap = new Map(cachedSongs.map((s) => [s.genius_id, s]))

    const results = geniusResults.map((r) => ({
      ...r,
      db_id: cacheMap.get(r.genius_id)?.id ?? null,
      lyrics_status: cacheMap.get(r.genius_id)?.lyrics_status ?? null,
    }))

    cache.set(q, { data: results, expires: Date.now() + 60_000 })
    return Response.json({ results })
  } catch (error) {
    console.error('Search error:', error)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
