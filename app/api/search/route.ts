import { NextRequest } from 'next/server'
import { searchSongs } from '@/lib/genius'
import { geniusFetchRaw } from '@/lib/genius'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  const type = request.nextUrl.searchParams.get('type') ?? 'songs'

  if (!q || q.length < 2) return Response.json([])

  if (type === 'songs') {
    const hits = await searchSongs(q)
    return Response.json(hits)
  }

  if (type === 'artists') {
    const params = new URLSearchParams({ q, per_page: '20' })
    const data = await geniusFetchRaw(`/search?${params}`)
    const rawHits = data.response.hits.filter((h: { type: string }) => h.type === 'song')

    const seen = new Set<string>()
    const artists: Array<{ id: string; name: string; image_url: string | null }> = []

    for (const hit of rawHits) {
      const a = hit.result.primary_artist
      const aid = String(a.id)
      if (seen.has(aid)) continue
      seen.add(aid)
      artists.push({ id: aid, name: a.name, image_url: a.image_url ?? null })
      if (artists.length >= 10) break
    }
    return Response.json(artists)
  }

  if (type === 'albums') {
    const params = new URLSearchParams({ q, per_page: '20' })
    const data = await geniusFetchRaw(`/search?${params}`)
    const rawHits = data.response.hits.filter((h: { type: string }) => h.type === 'song')

    const seen = new Set<string>()
    const albums: Array<{ id: string; name: string; cover_art_url: string | null; artist: string }> = []

    for (const hit of rawHits) {
      const song = hit.result
      if (!song.album) continue
      const albumId = String(song.album.id)
      if (seen.has(albumId)) continue
      seen.add(albumId)
      albums.push({
        id: albumId,
        name: song.album.name,
        cover_art_url: song.album.cover_art_url ?? null,
        artist: song.artist_names,
      })
      if (albums.length >= 10) break
    }
    return Response.json(albums)
  }

  return Response.json([])
}
