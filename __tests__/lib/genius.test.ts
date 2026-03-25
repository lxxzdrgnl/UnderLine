import { describe, it, expect, vi } from 'vitest'
import type { GeniusHit } from '@/types'

global.fetch = vi.fn()

describe('searchSongs', () => {
  it('검색 결과를 GeniusSearchResult 배열로 반환한다', async () => {
    const mockHit: GeniusHit = {
      type: 'song',
      result: {
        id: 12345,
        title: 'HUMBLE.',
        artist_names: 'Kendrick Lamar',
        song_art_image_thumbnail_url: 'https://example.com/img.jpg',
        path: '/Kendrick-lamar-humble-lyrics',
      },
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: { status: 200 },
        response: { hits: [mockHit] },
      }),
    } as Response)

    const { searchSongs } = await import('@/lib/genius')
    const results = await searchSongs('kendrick humble')

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      genius_id: '12345',
      title: 'HUMBLE.',
      artist: 'Kendrick Lamar',
      image_url: 'https://example.com/img.jpg',
      genius_path: '/Kendrick-lamar-humble-lyrics',
    })
  })

  it('song 타입이 아닌 hit은 필터링한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: { hits: [{ type: 'artist', result: {} }] },
      }),
    } as Response)

    const { searchSongs } = await import('@/lib/genius')
    const results = await searchSongs('test')
    expect(results).toHaveLength(0)
  })
})
