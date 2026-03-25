import { NextRequest } from 'next/server'
import { geniusFetchRaw, searchSongs, fetchSongDetail } from '@/lib/genius'
import { searchSpotifyAlbums, getSpotifyAlbumFirstTrack } from '@/lib/spotify'
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
    const spotifyAlbums = await searchSpotifyAlbums(q)

    // Match each Spotify album to a Genius album ID in parallel
    // For each Spotify album: get first track → search Genius → get album ID
    const matched = await Promise.all(
      spotifyAlbums.map(async (sa) => {
        try {
          // 1. Get first track from Spotify album
          const track = await getSpotifyAlbumFirstTrack(sa.id)
          if (!track) return null

          // 2. Search Genius for that track
          const songs = await searchSongs(`${track.name} ${track.artist}`, 1, 5)
          if (songs.length === 0) return null

          // 3. Find a matching song (artist name check)
          const artistLower = sa.artist.toLowerCase()
          const matchedSong = songs.find((s) => s.artist.toLowerCase().includes(artistLower))
          if (!matchedSong) return null

          // 4. Get song detail → extract album ID
          const detail = await fetchSongDetail(matchedSong.genius_id)
          if (!detail?.genius_album_id) return null

          return {
            id: detail.genius_album_id,
            name: sa.name,
            cover_art_url: sa.cover_art_url,
            artist: sa.artist,
          }
        } catch { return null }
      })
    )

    const seen = new Set<string>()
    const items = matched.filter((a): a is NonNullable<typeof a> => {
      if (!a || seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })

    return Response.json({ items, hasMore: false })
  }

  return Response.json({ items: [], hasMore: false })
}
