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
import { stripRomanized } from '@/lib/strings'
import type { GeniusSearchResult } from '@/types'

export async function POST(request: NextRequest) {
  const body: GeniusSearchResult = await request.json()

  // If song already exists, return immediately. Detail filled on page visit.
  const existing = await prisma.song.findUnique({ where: { genius_id: body.genius_id } })
  if (existing) {
    return Response.json({ id: existing.id })
  }

  // Create with basic info only. fetchSongDetail happens on song page.
  const song = await prisma.song.create({
    data: {
      genius_id: body.genius_id,
      title: stripRomanized(body.title),
      artist: body.artist,
      image_url: body.image_url,
      genius_path: body.genius_path,
    },
  })

  return Response.json({ id: song.id })
}
