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
import { getReferents } from '@/lib/genius'
import { streamLyricInterpretations } from '@/lib/gpt'
import { randomUUID } from 'crypto'
import type { LyricLineData } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STALE_LOCK_MS = 5 * 60 * 1000

type LyricsAction =
  | { type: 'serve_cached'; lines: LyricLineData[] }
  | { type: 'processing' }
  | { type: 'generate'; song: { genius_id: string; genius_path: string }; generationId: string }

export async function determineLyricsAction(songId: string): Promise<LyricsAction> {
  const song = await prisma.song.findUnique({ where: { id: songId } })
  if (!song) throw new Error('Song not found')

  if (song.lyrics_status === 'DONE') {
    const lines = await prisma.lyricLine.findMany({
      where: { song_id: songId },
      orderBy: { line_number: 'asc' },
      select: {
        line_number: true,
        original: true,
        translation: true,
        slang: true,
        explanation: true,
      },
    })
    return { type: 'serve_cached', lines }
  }

  const isStale =
    song.lyrics_status === 'PROCESSING' &&
    song.locked_at != null &&
    Date.now() - song.locked_at.getTime() > STALE_LOCK_MS

  if (song.lyrics_status === 'PROCESSING' && !isStale) {
    return { type: 'processing' }
  }

  const generationId = randomUUID()
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MS)

  const { count } = await prisma.song.updateMany({
    where: {
      id: songId,
      OR: [
        { lyrics_status: 'NONE' },
        { lyrics_status: 'FAILED' },
        { lyrics_status: 'PROCESSING', locked_at: { lt: staleThreshold } },
      ],
    },
    data: { lyrics_status: 'PROCESSING', locked_at: new Date(), generation_id: generationId },
  })

  if (count === 0) return { type: 'processing' }
  return { type: 'generate', song, generationId }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let action: LyricsAction
  try {
    action = await determineLyricsAction(id)
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (action.type === 'processing') {
    return Response.json({ status: 'processing' }, { status: 202 })
  }

  const encoder = new TextEncoder()

  if (action.type === 'serve_cached') {
    const stream = new ReadableStream({
      start(controller) {
        for (const line of action.lines) {
          controller.enqueue(
            encoder.encode(JSON.stringify({
              line: line.line_number,
              original: line.original,
              translation: line.translation,
              slang: line.slang,
              explanation: line.explanation,
            }) + '\n')
          )
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
        await prisma.lyricLine.deleteMany({ where: { song_id: id } })

        const cachedRaw = await prisma.songLyricsRaw.findUnique({
          where: { song_id: id },
        })
        let rawLyrics: string
        if (cachedRaw) {
          rawLyrics = cachedRaw.raw_text
        } else {
          rawLyrics = await scrapeLyrics(song.genius_path)
          await prisma.songLyricsRaw.create({
            data: { song_id: id, raw_text: rawLyrics },
          })
        }

        const referentsContext = await getReferents(song.genius_id)

        for await (const line of streamLyricInterpretations(rawLyrics, referentsContext)) {
          controller.enqueue(
            encoder.encode(JSON.stringify({
              line: line.line_number,
              original: line.original,
              translation: line.translation,
              slang: line.slang,
              explanation: line.explanation,
            }) + '\n')
          )
          buffer.push(line)
          if (buffer.length >= 10) await flushBuffer()
        }

        await flushBuffer()
        await prisma.song.update({
          where: { id },
          data: { lyrics_status: 'DONE' },
        })
      } catch (error) {
        console.error('Lyrics generation error:', error)
        await prisma.lyricLine.deleteMany({ where: { song_id: id } })
        await prisma.song.update({
          where: { id },
          data: { lyrics_status: 'FAILED' },
        })
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: 'Generation failed' }) + '\n')
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}
