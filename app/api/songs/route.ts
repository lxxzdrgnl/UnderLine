/**
 * @swagger
 * /api/songs:
 *   post:
 *     summary: 곡 upsert (검색 결과 선택 시)
 *     tags: [Songs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GeniusSearchResult'
 *     responses:
 *       200:
 *         description: 생성 또는 기존 곡 ID
 */
import { NextRequest } from 'next/server'
import { upsertSongFromSearchResult } from '@/lib/songs'
import type { GeniusSearchResult } from '@/types'

export async function POST(request: NextRequest) {
  const body: GeniusSearchResult = await request.json()
  const song = await upsertSongFromSearchResult(body)
  return Response.json({ id: song.id })
}
