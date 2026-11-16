import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    song: { update: vi.fn() },
    lyricLine: { deleteMany: vi.fn(), createMany: vi.fn() },
    songLyricsRaw: {
      findUnique: vi.fn().mockResolvedValue({ raw_text: 'a\nb\nc', annotations: [] }),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/lyrics-service', () => ({
  determineLyricsAction: vi.fn().mockResolvedValue({
    type: 'generate',
    song: { genius_id: '1', genius_path: '/x' },
    generationId: 'gen-1',
  }),
}))

vi.mock('@/lib/gpt', () => ({
  streamLyricInterpretations: async function* () {
    for (let i = 1; i <= 3; i++) {
      await new Promise((r) => setTimeout(r, 5))
      yield { line_number: i, original: `l${i}`, translation: null, slang: null, explanation: null }
    }
  },
}))

describe('GET /api/songs/[id]/lyrics', () => {
  it('클라이언트가 중간에 끊겨도 생성을 끝까지 저장하고 DONE 처리한다', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { GET } = await import('@/app/api/songs/[id]/lyrics/route')

    const res = await GET(new NextRequest('http://localhost/api/songs/s1/lyrics'), {
      params: Promise.resolve({ id: 's1' }),
    })

    // 첫 줄만 읽고 연결 끊기
    const reader = res.body!.getReader()
    await reader.read()
    await reader.cancel()

    await vi.waitFor(() => {
      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { lyrics_status: 'DONE' },
      })
    })

    const saved = vi.mocked(prisma.lyricLine.createMany).mock.calls.flatMap(
      ([arg]) => (arg as { data: { line_number: number }[] }).data,
    )
    expect(saved.map((l) => l.line_number)).toEqual([1, 2, 3])
    expect(prisma.song.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lyrics_status: 'NONE' }) }),
    )
  })
})
