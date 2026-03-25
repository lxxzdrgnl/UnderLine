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
import { prisma } from '@/lib/prisma'
import type { GeniusSearchResult } from '@/types'

export async function POST(request: NextRequest) {
  const body: GeniusSearchResult = await request.json()

  const song = await prisma.song.upsert({
    where: { genius_id: body.genius_id },
    create: {
      genius_id: body.genius_id,
      title: body.title,
      artist: body.artist,
      image_url: body.image_url,
      genius_path: body.genius_path,
    },
    update: {},
  })

  return Response.json({ id: song.id })
}
