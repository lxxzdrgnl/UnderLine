import { prisma } from '@/lib/prisma'

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

export async function getNowPlaying(userId: string): Promise<NowPlayingTrack | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'spotify' },
  })
  if (!account?.access_token) return null

  // 토큰 만료 체크 — 30초 여유
  let token = account.access_token
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 30) {
    if (!account.refresh_token) return null
    const refreshed = await refreshSpotifyToken(account.id, account.refresh_token)
    if (!refreshed) return null
    token = refreshed
  }

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

  let token = account.access_token
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 30) {
    if (!account.refresh_token) return []
    const refreshed = await refreshSpotifyToken(account.id, account.refresh_token)
    if (!refreshed) return []
    token = refreshed
  }

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

  let token = account.access_token
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 30) {
    if (!account.refresh_token) return []
    const refreshed = await refreshSpotifyToken(account.id, account.refresh_token)
    if (!refreshed) return []
    token = refreshed
  }

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
