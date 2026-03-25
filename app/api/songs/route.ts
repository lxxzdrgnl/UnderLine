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
import { fetchSongDetail } from '@/lib/genius'
import { stripRomanized } from '@/lib/strings'
import type { GeniusSearchResult } from '@/types'

export async function POST(request: NextRequest) {
  const body: GeniusSearchResult = await request.json()

  // Fetch extended metadata from Genius (best-effort, non-blocking on failure)
  const detail = await fetchSongDetail(body.genius_id)

  const song = await prisma.song.upsert({
    where: { genius_id: body.genius_id },
    create: {
      genius_id: body.genius_id,
      title: stripRomanized(body.title),
      artist: body.artist,
      image_url: body.image_url,
      genius_path: body.genius_path,
      album: detail?.album ?? null,
      album_image_url: detail?.album_image_url ?? null,
      release_date: detail?.release_date ?? null,
      description: detail?.description ?? null,
      spotify_url: detail?.spotify_url ?? null,
      youtube_url: detail?.youtube_url ?? null,
      apple_music_url: detail?.apple_music_url ?? null,
      genius_artist_id: detail?.genius_artist_id ?? null,
      genius_album_id: detail?.genius_album_id ?? null,
      featured_artists: detail?.featured_artists ?? [],
    },
    update: {
      artist: body.artist,
      title: stripRomanized(body.title),
      image_url: body.image_url,
      // Refresh detail fields on re-upsert in case they were missing before
      ...(detail && {
        album: detail.album,
        album_image_url: detail.album_image_url,
        release_date: detail.release_date,
        description: detail.description,
        spotify_url: detail.spotify_url,
        youtube_url: detail.youtube_url,
        apple_music_url: detail.apple_music_url,
        genius_artist_id: detail.genius_artist_id,
        genius_album_id: detail.genius_album_id,
        featured_artists: detail.featured_artists ?? [],
      }),
    },
  })

  return Response.json({ id: song.id })
}
