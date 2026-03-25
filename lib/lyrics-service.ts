import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import type { LyricLineData } from '@/types'

export const STALE_LOCK_MS = 5 * 60 * 1000

export type LyricsAction =
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
