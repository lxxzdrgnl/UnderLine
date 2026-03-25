/**
 * @swagger
 * /api/songs/{id}:
 *   get:
 *     summary: 곡 메타데이터 조회
 *     tags: [Songs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 곡 메타데이터
 *       404:
 *         description: 곡 없음
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const song = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      genius_id: true,
      title: true,
      artist: true,
      image_url: true,
      genius_path: true,
      lyrics_status: true,
    },
  })

  if (!song) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(song)
}
