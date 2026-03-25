import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSpotifyPlaylistTracks } from '@/lib/spotify'
import { searchSongs } from '@/lib/genius'

const MAX_PLAYLISTS = 50
const CONCURRENCY = 5

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { spotifyPlaylistId, name } = await request.json()
  if (!spotifyPlaylistId) {
    return Response.json({ error: 'spotifyPlaylistId required' }, { status: 400 })
  }

  // Check playlist limit
  const count = await prisma.playlist.count({ where: { userId: session.user.id } })
  if (count >= MAX_PLAYLISTS) {
    return Response.json({ error: 'playlist_limit_reached', limitReached: true }, { status: 422 })
  }

  // Fetch all tracks from Spotify
  const tracks = await getSpotifyPlaylistTracks(session.user.id, spotifyPlaylistId)
  console.log('[import/spotify] fetched', tracks.length, 'tracks from Spotify playlist', spotifyPlaylistId)
  if (tracks.length === 0) {
    return Response.json({ error: 'empty_playlist', message: 'Spotify에서 트랙을 가져오지 못했어요. Spotify 재연동이 필요할 수 있어요.' }, { status: 422 })
  }

  // Determine playlist name
  let playlistName = name?.trim() || 'Spotify Import'
  const existing = await prisma.playlist.findUnique({
    where: { userId_name: { userId: session.user.id, name: playlistName } },
  })
  if (existing) playlistName += ' (가져오기)'

  // Create the playlist
  const playlist = await prisma.playlist.create({
    data: { userId: session.user.id, name: playlistName },
  })

  // Search Genius for each track with concurrency limit
  let imported = 0
  let skipped = 0

  function normalize(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
  }

  function isRelevantMatch(spotifyTitle: string, geniusTitle: string) {
    const a = normalize(spotifyTitle)
    const b = normalize(geniusTitle)
    // Either title contains the other, or they share significant overlap
    return a.includes(b) || b.includes(a) || a === b
  }

  async function processTrack(track: { title: string; artist: string }, position: number) {
    try {
      const results = await searchSongs(`${track.title} ${track.artist}`)
      if (results.length === 0) { skipped++; return }

      // Find first result that actually matches the song title
      const hit = results.find((r) => isRelevantMatch(track.title, r.title))
      if (!hit) { skipped++; return }
      // Only save genius_id + basic info from search. Detail fetched on song page visit.
      const song = await prisma.song.upsert({
        where: { genius_id: hit.genius_id },
        create: {
          genius_id: hit.genius_id,
          title: hit.title,
          artist: hit.artist,
          image_url: hit.image_url,
          genius_path: hit.genius_path,
        },
        update: {},
      })

      await prisma.playlistSong.create({
        data: { playlistId: playlist.id, songId: song.id, position },
      }).catch(() => {}) // ignore duplicate

      imported++
    } catch {
      skipped++
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < tracks.length; i += CONCURRENCY) {
    const batch = tracks.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map((track, j) => processTrack(track, i + j)))
  }

  return Response.json({
    playlistId: playlist.id,
    imported,
    skipped,
    total: tracks.length,
  })
}
