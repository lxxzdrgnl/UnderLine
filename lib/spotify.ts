import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

// ─── Client Credentials (no user auth needed) ─────────────────
let clientToken: string | null = null
let clientTokenExpiresAt = 0

async function getSpotifyClientToken(): Promise<string | null> {
  if (clientToken && clientTokenExpiresAt > Date.now() + 30_000) return clientToken
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) return null
  const data = await res.json() as { access_token: string; expires_in: number }
  clientToken = data.access_token
  clientTokenExpiresAt = Date.now() + data.expires_in * 1000
  return clientToken
}

export interface SpotifyAlbum {
  id: string
  name: string
  image_url: string | null
  release_date: string | null
  album_type: string
}

async function _fetchSpotifyArtistAlbums(artistName: string): Promise<SpotifyAlbum[]> {
  const token = await getSpotifyClientToken()
  if (!token) { console.error('[spotify] no client token for', artistName); return [] }

  // 1. Search for artist
  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  )
  if (!searchRes.ok) { console.error('[spotify] artist search failed', searchRes.status, artistName); return [] }
  const searchData = await searchRes.json()
  const spotifyArtist = searchData.artists?.items?.[0]
  if (!spotifyArtist) { console.error('[spotify] artist not found on spotify:', artistName); return [] }

  // 2. Get albums
  const albumsRes = await fetch(
    `https://api.spotify.com/v1/artists/${spotifyArtist.id}/albums?include_groups=album,single,compilation&limit=50&market=KR`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  )
  if (!albumsRes.ok) {
    console.error('[spotify] albums fetch failed', albumsRes.status, artistName)
    throw new Error(`Spotify albums fetch failed: ${albumsRes.status}`)
  }
  const albumsData = await albumsRes.json()

  const spotifyArtistId = spotifyArtist.id
  return (albumsData.items ?? [])
    .filter((a: { artists: { id: string }[]; album_type: string; total_tracks: number }) =>
      a.artists?.some((ar) => ar.id === spotifyArtistId)
      && (a.album_type === 'album' || a.total_tracks >= 4)
    )
    .map((a: { id: string; name: string; images: { url: string }[]; release_date: string; album_type: string }) => ({
      id: a.id,
      name: a.name,
      image_url: a.images?.[0]?.url ?? null,
      release_date: a.release_date ?? null,
      album_type: a.album_type,
    }))
}

export const fetchSpotifyArtistAlbums = (artistName: string) =>
  unstable_cache(
    () => _fetchSpotifyArtistAlbums(artistName),
    ['spotify-artist-albums', artistName],
    { revalidate: 3600 }
  )()

export async function getSpotifyAlbumFirstTrack(albumId: string): Promise<{ name: string; artist: string } | null> {
  const token = await getSpotifyClientToken()
  if (!token) return null
  const res = await fetch(
    `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  const track = data.items?.[0]
  if (!track) return null
  return {
    name: track.name,
    artist: track.artists?.map((a: { name: string }) => a.name).join(', ') ?? '',
  }
}

export async function searchSpotifyAlbums(query: string): Promise<Array<{ id: string; name: string; cover_art_url: string | null; artist: string }>> {
  const token = await getSpotifyClientToken()
  if (!token) return []
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=10&market=KR`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.albums?.items ?? []).map((a: { id: string; name: string; images: { url: string }[]; artists: { name: string }[] }) => ({
    id: a.id,
    name: a.name,
    cover_art_url: a.images?.[0]?.url ?? null,
    artist: a.artists?.map((ar) => ar.name).join(', ') ?? '',
  }))
}

export interface NowPlayingTrack {
  title: string
  artist: string
  album: string
  image_url: string | null
  is_playing: boolean
  progress_ms: number
  duration_ms: number
  spotify_url: string
}

async function refreshSpotifyToken(accountId: string, refreshToken: string): Promise<string | null> {
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })

  if (!res.ok) return null

  const data = await res.json() as { access_token: string; expires_in: number; refresh_token?: string }

  await prisma.account.update({
    where: { id: accountId },
    data: {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      ...(data.refresh_token && { refresh_token: data.refresh_token }),
    },
  })

  return data.access_token
}

async function getValidSpotifyToken(
  account: { id: string; access_token: string | null; refresh_token: string | null; expires_at: number | null }
): Promise<string | null> {
  if (!account.access_token) return null
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 30) {
    if (!account.refresh_token) return null
    return refreshSpotifyToken(account.id, account.refresh_token)
  }
  return account.access_token
}

export async function getNowPlaying(userId: string): Promise<NowPlayingTrack | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'spotify' },
  })
  if (!account?.access_token) return null

  // 토큰 만료 체크 — 30초 여유
  const token = await getValidSpotifyToken(account)
  if (!token) return null

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  })

  // 204 = 재생 없음
  if (res.status === 204 || !res.ok) return null

  const data = await res.json()
  if (data.currently_playing_type !== 'track' || !data.item) return null

  const track = data.item
  return {
    title: track.name,
    artist: track.artists.map((a: { name: string }) => a.name).join(', '),
    album: track.album.name,
    image_url: track.album.images?.[0]?.url ?? null,
    is_playing: data.is_playing,
    progress_ms: data.progress_ms ?? 0,
    duration_ms: track.duration_ms,
    spotify_url: track.external_urls?.spotify ?? '',
  }
}

export interface SpotifyPlaylist {
  id: string
  name: string
  trackCount: number
  image_url: string | null
  isOwn: boolean
}

export async function getSpotifyPlaylists(userId: string): Promise<SpotifyPlaylist[]> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'spotify' },
    select: { access_token: true, refresh_token: true, expires_at: true, id: true, providerAccountId: true },
  })
  if (!account?.access_token) return []

  const token = await getValidSpotifyToken(account)
  if (!token) return []

  const playlists: SpotifyPlaylist[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50'

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error('[spotify] playlists fetch failed:', res.status, await res.text().catch(() => ''))
      break
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    for (const item of (data.items ?? []) as any[]) {
      // 2026 Feb API change: "tracks" renamed to "items" in playlist object
      const tracksObj = item.tracks ?? item.items
      const ownerId = item.owner?.id
      playlists.push({
        id: item.id,
        name: item.name,
        trackCount: typeof tracksObj === 'object' ? (tracksObj?.total ?? 0) : 0,
        image_url: item.images?.[0]?.url ?? null,
        isOwn: ownerId === account.providerAccountId,
      })
    }
    url = data.next ?? null
  }

  return playlists
}

export interface SpotifyTrack {
  title: string
  artist: string
  spotifyId: string
}

export async function getSpotifyPlaylistTracks(userId: string, playlistId: string): Promise<SpotifyTrack[]> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'spotify' },
  })
  if (!account?.access_token) return []

  const token = await getValidSpotifyToken(account)
  if (!token) return []

  const tracks: SpotifyTrack[] = []
  // 2026 Feb API change: /tracks → /items
  let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=100`

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error('[spotify] tracks fetch failed:', res.status, await res.text().catch(() => ''))
      break
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    for (const item of (data.items ?? []) as any[]) {
      // 2026 Feb: "track" renamed to "item"
      const t = item.item ?? item.track
      if (!t?.name) continue
      tracks.push({
        title: t.name,
        artist: t.artists?.map((a: { name: string }) => a.name).join(', ') ?? '',
        spotifyId: t.id,
      })
    }
    url = data.next
  }

  return tracks
}
