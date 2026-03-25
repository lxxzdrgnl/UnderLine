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
import { logger } from '@/lib/logger'
import { stripRomanized, isGeniusRomanizations } from '@/lib/strings'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

// 메모리 캐시 (60초 TTL, 최대 200개)
const cache = new Map<string, { data: unknown; expires: number }>()
function setCache(key: string, value: { data: unknown; expires: number }) {
  if (cache.size >= 200) cache.delete(cache.keys().next().value!)
  cache.set(key, value)
}

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
      title: stripRomanized(r.title),
      artist: isGeniusRomanizations(r.artist)
        ? r.title.match(/^(.+?)\s*[-–]\s*/)?.[1]?.trim() ?? r.artist
        : r.artist,
      db_id: cacheMap.get(r.genius_id)?.id ?? null,
      lyrics_status: cacheMap.get(r.genius_id)?.lyrics_status ?? null,
    }))

    setCache(q, { data: results, expires: Date.now() + 60_000 })
    return Response.json({ results })
  } catch (error) {
    logger.error('search: failed', {
      q,
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json(apiError(request.nextUrl.pathname, 500, 'GENIUS_API_ERROR'), { status: 500 })
  }
}
