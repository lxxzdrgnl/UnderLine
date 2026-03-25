import { NextRequest } from 'next/server'
import { geniusFetchRaw } from '@/lib/genius'
import type { GeniusSearchResult } from '@/types'

export const dynamic = 'force-dynamic'

const PER_PAGE = 15

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  const type = request.nextUrl.searchParams.get('type') ?? 'songs'
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)

  if (!q || q.length < 2) return Response.json({ items: [], hasMore: false })

  const params = new URLSearchParams({ q, per_page: String(PER_PAGE), page: String(page) })
  const data = await geniusFetchRaw(`/search?${params}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawHits = (data.response.hits as any[]).filter((h) => h.type === 'song')
  const hasMore = rawHits.length >= PER_PAGE

  if (type === 'songs') {
    const items: GeniusSearchResult[] = rawHits.map((hit) => ({
      genius_id: String(hit.result.id),
      title: hit.result.title,
      artist: hit.result.artist_names,
      image_url: hit.result.song_art_image_thumbnail_url ?? null,
      genius_path: hit.result.path,
    }))
    return Response.json({ items, hasMore })
  }

  if (type === 'artists') {
    const seen = new Set<string>()
    const items: Array<{ id: string; name: string; image_url: string | null }> = []

    for (const hit of rawHits) {
      const a = hit.result.primary_artist
      const aid = String(a.id)
      if (seen.has(aid)) continue
      seen.add(aid)
      items.push({ id: aid, name: a.name, image_url: a.image_url ?? null })
    }
    return Response.json({ items, hasMore })
  }

  if (type === 'albums') {
    const seen = new Set<string>()
    const items: Array<{ id: string; name: string; cover_art_url: string | null; artist: string }> = []

    for (const hit of rawHits) {
      const song = hit.result
      if (!song.album) continue
      const albumId = String(song.album.id)
      if (seen.has(albumId)) continue
      seen.add(albumId)
      items.push({
        id: albumId,
        name: song.album.name,
        cover_art_url: song.album.cover_art_url ?? null,
        artist: song.artist_names,
      })
    }
    return Response.json({ items, hasMore })
  }

  return Response.json({ items: [], hasMore: false })
}
