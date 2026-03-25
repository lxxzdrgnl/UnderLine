import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    song: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    lyricLine: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    songLyricsRaw: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('determineLyricsAction', () => {
  it('DONE 상태면 serve_cached를 반환한다', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: 'song-1',
      genius_id: '123',
      genius_path: '/test',
      lyrics_status: 'DONE',
      locked_at: null,
      generation_id: 'gen-1',
    } as any)

    vi.mocked(prisma.lyricLine.findMany).mockResolvedValue([
      {
        line_number: 1,
        original: 'Hello',
        translation: '안녕',
        slang: null,
        explanation: null,
        generation_id: 'gen-1',
      },
    ] as any)

    const { determineLyricsAction } = await import('@/lib/lyrics-service')
    const action = await determineLyricsAction('song-1')
    expect(action.type).toBe('serve_cached')
  })

  it('PROCESSING이고 최근이면 processing을 반환한다', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: 'song-1',
      lyrics_status: 'PROCESSING',
      locked_at: new Date(),
    } as any)

    const { determineLyricsAction } = await import('@/lib/lyrics-service')
    const action = await determineLyricsAction('song-1')
    expect(action.type).toBe('processing')
  })
})
