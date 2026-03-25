import type { GeniusSearchResult, GeniusHit } from '@/types'
import { cleanRomanizedAlbum, isGeniusRomanizations } from '@/lib/strings'

const BASE_URL = 'https://api.genius.com'

async function geniusFetch(path: string, revalidate = 0) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}` },
    next: { revalidate },
  })
  if (!res.ok) throw new Error(`Genius API error: ${res.status}`)
  return res.json()
}

export { geniusFetch as geniusFetchRaw }

function isTranslationPage(hit: GeniusHit): boolean {
  return /-translation$/.test(hit.result.path)
    || hit.result.artist_names?.startsWith('Genius') === true
}

export async function searchSongs(query: string, page = 1, perPage = 10): Promise<GeniusSearchResult[]> {
  // Request more to account for filtered translation pages
  const fetchSize = Math.min(perPage * 3, 50)
  const params = new URLSearchParams({ q: query, per_page: String(fetchSize), page: String(page) })
  const data = await geniusFetch(`/search?${params}`)

  return (data.response.hits as GeniusHit[])
    .filter((hit) => hit.type === 'song' && !isTranslationPage(hit))
    .slice(0, perPage)
    .map((hit) => ({
      genius_id: String(hit.result.id),
      title: hit.result.title,
      artist: hit.result.artist_names,
      image_url: hit.result.song_art_image_thumbnail_url ?? null,
      genius_path: hit.result.path,
    }))
}

export interface SongDetail {
  title: string
  artist: string
  image_url: string | null
  genius_path: string
  album: string | null
  album_image_url: string | null
  release_date: string | null
  description: string | null
  spotify_url: string | null
  youtube_url: string | null
  apple_music_url: string | null
  genius_artist_id: string | null
  genius_album_id: string | null
  featured_artists: Array<{ id: string; name: string }> | null
}

export async function fetchSongDetail(geniusId: string): Promise<SongDetail | null> {
  try {
    const data = await geniusFetch(`/songs/${geniusId}?text_format=plain`)
    const song = data.response.song

    const media: Array<{ provider: string; url: string }> = song.media ?? []
    const spotifyMedia = media.find((m) => m.provider === 'spotify')
    const youtubeMedia = media.find((m) => m.provider === 'youtube')
    const appleMedia = media.find((m) => m.provider === 'apple_music')

    const isRomanization = isGeniusRomanizations(song.primary_artist?.name ?? '')
    const featuredArtists: Array<{ id: string; name: string }> = (song.featured_artists ?? []).map(
      (a: { id: number; name: string }) => ({ id: String(a.id), name: a.name })
    )

    // For Genius Romanizations, find the original song via song_relationships and use its artist
    let effectiveArtistId: string | null = song.primary_artist?.id ? String(song.primary_artist.id) : null
    if (isRomanization) {
      const rels: Array<{ relationship_type: string; songs: Array<{ id: number; primary_artist?: { id: number } }> }> =
        song.song_relationships ?? []
      const original = rels.find((r) => r.relationship_type === 'translation_of')
      const originalSong = original?.songs?.[0]
      if (originalSong?.primary_artist?.id) {
        effectiveArtistId = String(originalSong.primary_artist.id)
      } else if (originalSong?.id) {
        // Fetch original song to get artist ID
        try {
          const origData = await geniusFetch(`/songs/${originalSong.id}`)
          const origArtistId = origData.response.song.primary_artist?.id
          if (origArtistId) effectiveArtistId = String(origArtistId)
        } catch { /* keep null */ }
      }
    }

    const rawDesc = song.description?.plain?.trim() || null
    const rawAlbum = song.album?.name ?? null

    return {
      title: song.title ?? '',
      artist: song.primary_artist?.name ?? '',
      image_url: song.song_art_image_thumbnail_url ?? song.header_image_thumbnail_url ?? null,
      genius_path: song.path ?? '',
      album: rawAlbum ? cleanRomanizedAlbum(rawAlbum) || null : null,
      album_image_url: song.album?.cover_art_url ?? null,
      release_date: song.release_date_for_display ?? null,
      description: rawDesc === '?' ? null : rawDesc,
      spotify_url: spotifyMedia?.url ?? null,
      youtube_url: youtubeMedia?.url ?? null,
      apple_music_url: appleMedia?.url ?? null,
      genius_artist_id: effectiveArtistId,
      genius_album_id: song.album?.id ? String(song.album.id) : null,
      featured_artists: isRomanization ? [] : featuredArtists,
    }
  } catch {
    return null
  }
}

// ─── Album ────────────────────────────────────────────────

export interface AlbumDetail {
  id: string
  name: string
  cover_art_url: string | null
  release_date: string | null
  artist_name: string
  genius_artist_id: string | null
  description: string | null
  track_count: number
}

export interface AlbumTrack {
  track_number: number
  genius_id: string
  title: string
  artist: string
  image_url: string | null
}

export async function fetchAlbumDetail(id: string): Promise<AlbumDetail | null> {
  try {
    const data = await geniusFetch(`/albums/${id}?text_format=plain`, 86400)
    const album = data.response.album
    return {
      id: String(album.id),
      name: album.name,
      cover_art_url: album.cover_art_url ?? null,
      release_date: album.release_date_for_display ?? null,
      artist_name: album.artist?.name ?? '',
      genius_artist_id: album.artist?.id ? String(album.artist.id) : null,
      description: album.description?.plain?.trim() && album.description.plain.trim() !== '?' ? album.description.plain.trim() : null,
      track_count: album.song_performances?.[0]?.songs?.length ?? 0,
    }
  } catch {
    return null
  }
}

export async function fetchAlbumTracks(id: string): Promise<AlbumTrack[]> {
  try {
    const data = await geniusFetch(`/albums/${id}/tracks`, 86400)
    return (data.response.tracks as Array<{
      track_number: number
      song: {
        id: number
        title: string
        artist_names: string
        song_art_image_thumbnail_url: string | null
      }
    }>).map((t) => ({
      track_number: t.track_number,
      genius_id: String(t.song.id),
      title: t.song.title,
      artist: t.song.artist_names,
      image_url: t.song.song_art_image_thumbnail_url ?? null,
    }))
  } catch {
    return []
  }
}

// ─── Artist ───────────────────────────────────────────────

export interface ArtistInfo {
  id: string
  name: string
  image_url: string | null
  header_image_url: string | null
  description: string | null
  alternate_names: string[]
  is_verified: boolean
  social_links: { instagram?: string; twitter?: string; facebook?: string }
}

export interface ArtistSong {
  genius_id: string
  title: string
  artist: string
  image_url: string | null
}

export async function fetchArtistInfo(id: string): Promise<ArtistInfo | null> {
  try {
    const data = await geniusFetch(`/artists/${id}?text_format=plain`, 86400)
    const artist = data.response.artist
    const desc = artist.description?.plain?.trim()
    return {
      id: String(artist.id),
      name: artist.name,
      image_url: artist.image_url ?? null,
      header_image_url: artist.header_image_url ?? null,
      description: desc && desc !== '?' ? desc : null,
      alternate_names: Array.isArray(artist.alternate_names) ? artist.alternate_names : [],
      is_verified: !!artist.is_verified,
      social_links: artist.social_links ?? {},
    }
  } catch {
    return null
  }
}

export async function fetchArtistSongs(id: string, page = 1): Promise<ArtistSong[]> {
  try {
    const params = new URLSearchParams({
      sort: 'popularity',
      per_page: '20',
      page: String(page),
    })
    const data = await geniusFetch(`/artists/${id}/songs?${params}`, 3600)
    return (data.response.songs as Array<{
      id: number
      title: string
      artist_names: string
      song_art_image_thumbnail_url: string | null
    }>).map((s) => ({
      genius_id: String(s.id),
      title: s.title,
      artist: s.artist_names,
      image_url: s.song_art_image_thumbnail_url ?? null,
    }))
  } catch {
    return []
  }
}


// ─── Romanization helpers ──────────────────────────────────

export { isRomanizationPath } from '@/lib/strings'

export async function fetchOriginalSongPath(geniusId: string): Promise<string | null> {
  try {
    const data = await geniusFetch(`/songs/${geniusId}`)
    const rels: Array<{ relationship_type: string; songs: Array<{ path: string }> }> =
      data.response.song.song_relationships ?? []
    const original = rels.find((r) => r.relationship_type === 'translation_of')
    return original?.songs?.[0]?.path ?? null
  } catch {
    return null
  }
}

// ─── Referents ────────────────────────────────────────────

export type ReferentRaw = { fragment: string; annotation: string }

export function isReferentRawArray(val: unknown): val is ReferentRaw[] {
  return Array.isArray(val) && val.every(
    (r) => typeof r === 'object' && r !== null &&
           typeof (r as ReferentRaw).fragment === 'string' &&
           typeof (r as ReferentRaw).annotation === 'string'
  )
}

export async function fetchReferentsRaw(geniusSongId: string): Promise<ReferentRaw[] | null> {
  try {
    const params = new URLSearchParams({
      song_id: geniusSongId,
      per_page: '50',
      text_format: 'plain',
    })
    const data = await geniusFetch(`/referents?${params}`)
    return (data.response.referents as Array<{
      fragment: string
      annotations: Array<{ body: { plain: string } }>
    }>).map((ref) => ({
      fragment: ref.fragment,
      annotation: ref.annotations?.[0]?.body?.plain ?? '',
    }))
  } catch {
    return null
  }
}

export function formatReferents(referents: ReferentRaw[]): string {
  return referents
    .map((ref) => `구절: "${ref.fragment}" / Genius 해설: ${ref.annotation}`)
    .join('\n')
}

/** @deprecated use fetchReferentsRaw + formatReferents */
export async function getReferents(geniusSongId: string): Promise<string> {
  const raw = await fetchReferentsRaw(geniusSongId)
  return raw ? formatReferents(raw) : ''
}
