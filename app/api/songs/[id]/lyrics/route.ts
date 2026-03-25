/**
 * @swagger
 * /api/songs/{id}/lyrics:
 *   get:
 *     summary: 가사 + 번역 + 해석 스트리밍 (NDJSON)
 *     tags: [Songs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: NDJSON 스트림 (각 줄이 LyricLine JSON)
 *         content:
 *           application/x-ndjson:
 *             schema:
 *               type: string
 *       202:
 *         description: 다른 프로세스가 처리 중 — 클라이언트 재시도 필요
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeLyrics } from '@/lib/scraper'
import { fetchReferentsRaw, formatReferents, isReferentRawArray, fetchOriginalSongPath, isRomanizationPath } from '@/lib/genius'
import { streamLyricInterpretations } from '@/lib/gpt'
import { logger } from '@/lib/logger'
import { apiError } from '@/lib/api-error'
import { determineLyricsAction, type LyricsAction } from '@/lib/lyrics-service'
import type { LyricLineData } from '@/types'

const encoder = new TextEncoder()

function encodeLine(line: LyricLineData): Uint8Array {
  return encoder.encode(JSON.stringify({
    line: line.line_number,
    original: line.original,
    translation: line.translation,
    slang: line.slang,
    explanation: line.explanation,
  }) + '\n')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let action: LyricsAction
  try {
    action = await determineLyricsAction(id)
  } catch {
    return Response.json(apiError(request.nextUrl.pathname, 404, 'SONG_NOT_FOUND'), { status: 404 })
  }

  if (action.type === 'processing') {
    return Response.json(apiError(request.nextUrl.pathname, 202, 'LYRICS_PROCESSING'), { status: 202 })
  }

  if (action.type === 'serve_cached') {
    const stream = new ReadableStream({
      start(controller) {
        for (const line of action.lines) {
          controller.enqueue(encodeLine(line))
        }
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson' },
    })
  }

  const { song, generationId } = action

  const stream = new ReadableStream({
    async start(controller) {
      const buffer: LyricLineData[] = []

      const flushBuffer = async () => {
        if (buffer.length === 0) return
        await prisma.lyricLine.createMany({
          data: buffer.map((line) => ({
            song_id: id,
            line_number: line.line_number,
            original: line.original,
            translation: line.translation,
            slang: line.slang,
            explanation: line.explanation,
            generation_id: generationId,
          })),
          skipDuplicates: true,
        })
        buffer.length = 0
      }

      try {
        logger.info('lyrics: start', { songId: id, generationId })
        await prisma.lyricLine.deleteMany({ where: { song_id: id } })

        const cachedRaw = await prisma.songLyricsRaw.findUnique({
          where: { song_id: id },
        })
        let rawLyrics: string
        let referentsContext: string
        if (cachedRaw) {
          logger.info('lyrics: using cached raw', { songId: id })
          rawLyrics = cachedRaw.raw_text
          referentsContext = isReferentRawArray(cachedRaw.annotations)
            ? formatReferents(cachedRaw.annotations)
            : ''
        } else {
          let scrapePath = song.genius_path
          if (isRomanizationPath(scrapePath)) {
            const originalPath = await fetchOriginalSongPath(song.genius_id)
            if (originalPath) {
              logger.info('lyrics: using original path', { original: originalPath, romanized: scrapePath })
              scrapePath = originalPath
            }
          }
          logger.info('lyrics: scraping', { path: scrapePath })
          rawLyrics = await scrapeLyrics(scrapePath)
          logger.info('lyrics: scraped', { lines: rawLyrics.split('\n').length })
          if (!rawLyrics) {
            logger.info('lyrics: no lyrics found', { songId: id })
            await prisma.song.update({ where: { id }, data: { lyrics_status: 'DONE' } })
            controller.enqueue(encoder.encode(JSON.stringify({ no_lyrics: true }) + '\n'))
            return
          }
          const rawAnnotations = await fetchReferentsRaw(song.genius_id)
          referentsContext = rawAnnotations ? formatReferents(rawAnnotations) : ''
          await prisma.songLyricsRaw.create({
            data: { song_id: id, raw_text: rawLyrics, annotations: rawAnnotations ?? [] },
          })
        }

        logger.info('lyrics: streaming GPT', { songId: id })

        for await (const line of streamLyricInterpretations(rawLyrics, referentsContext)) {
          controller.enqueue(encodeLine(line))
          buffer.push(line)
          if (buffer.length >= 10) await flushBuffer()
        }

        await flushBuffer()
        await prisma.song.update({
          where: { id },
          data: { lyrics_status: 'DONE' },
        })
        logger.info('lyrics: done', { songId: id })
      } catch (error) {
        logger.error('lyrics: generation failed', {
          songId: id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join(' | ') : undefined,
        })
        await prisma.lyricLine.deleteMany({ where: { song_id: id } })
        await prisma.song.update({
          where: { id },
          data: { lyrics_status: 'NONE', locked_at: null, generation_id: null },
        })
        try {
          controller.enqueue(
            encoder.encode(JSON.stringify({ error: 'Generation failed' }) + '\n')
          )
        } catch { /* client already disconnected */ }
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}
