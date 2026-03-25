import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchArtistInfo, fetchArtistSongs, fetchSongDetail, searchSongs } from '@/lib/genius'
import { translateText } from '@/lib/gpt'
import { fetchSpotifyArtistAlbums } from '@/lib/spotify'
import { prisma } from '@/lib/prisma'
import { ArtistSongs } from './ArtistSongs'
import { AlbumGrid } from './AlbumGrid'

async function AlbumsSection({ artistName, artistId, songIds }: { artistName: string; artistId: string; songIds: string[] }) {
  // 1. Build album map from DB + song details in parallel
  const dbSongs = await prisma.song.findMany({
    where: { genius_artist_id: artistId, genius_album_id: { not: null }, album: { not: null } },
    select: { genius_album_id: true, album: true, album_image_url: true },
    distinct: ['genius_album_id'],
  })

  // Map: album name (lowercase) → { genius_album_id, image }
  const albumMap = new Map<string, { id: string; name: string; image: string | null }>()
  for (const s of dbSongs) {
    if (s.album && s.genius_album_id) {
      albumMap.set(s.album.toLowerCase(), { id: s.genius_album_id, name: s.album, image: s.album_image_url })
    }
  }

  // Helper: fuzzy match Spotify album name to Genius album
  function findAlbumMatch(spotifyName: string) {
    const lower = spotifyName.toLowerCase()
    const exact = albumMap.get(lower)
    if (exact) return exact
    for (const [key, val] of albumMap) {
      if (key.includes(lower) || lower.includes(key)) return val
    }
    return null
  }

  // 2. Get Spotify albums for cover art + release dates
  const spotifyAlbums = await fetchSpotifyArtistAlbums(artistName)

  // 3. For unmatched Spotify albums, search Genius to find album IDs
  const unmatchedSpotify = spotifyAlbums.filter((sa) => !findAlbumMatch(sa.name))
  if (unmatchedSpotify.length > 0) {
    const results = await Promise.all(
      unmatchedSpotify.map(async (sa) => {
        const songs = await searchSongs(`${sa.name} ${artistName}`, 1, 1).catch(() => [])
        if (songs.length === 0) return null
        const detail = await fetchSongDetail(songs[0].genius_id).catch(() => null)
        if (!detail?.genius_album_id || !detail.album) return null
        return { album: detail.album, id: detail.genius_album_id, image: detail.album_image_url ?? null }
      })
    )
    for (const r of results) {
      if (r && !albumMap.has(r.album.toLowerCase())) {
        albumMap.set(r.album.toLowerCase(), { id: r.id, name: r.album, image: r.image })
      }
    }
  }

  // 3. Build final list: prefer Spotify image, use Genius ID for linking
  type AlbumItem = { id: string; name: string; image_url: string | null; release_date: string | null; href: string }
  const albums: AlbumItem[] = []
  const seen = new Set<string>()

  for (const sa of spotifyAlbums) {
    const match = findAlbumMatch(sa.name)
    if (match && !seen.has(match.id)) {
      seen.add(match.id)
      albums.push({ id: match.id, name: sa.name, image_url: sa.image_url, release_date: sa.release_date, href: `/albums/${match.id}` })
    } else if (!match) {
      albums.push({ id: sa.id, name: sa.name, image_url: sa.image_url, release_date: sa.release_date, href: `/search?q=${encodeURIComponent(sa.name + ' ' + artistName)}&type=albums` })
    }
  }

  // Sort by release date (newest first), null dates last
  albums.sort((a, b) => {
    if (!a.release_date && !b.release_date) return 0
    if (!a.release_date) return 1
    if (!b.release_date) return -1
    return b.release_date.localeCompare(a.release_date)
  })

  if (albums.length === 0) return null

  return (
    <section style={{ paddingTop: '32px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 'var(--text-xl)', fontWeight: 400, color: 'var(--text)' }}>
        앨범
      </h2>
      <AlbumGrid albums={albums} />
    </section>
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ArtistPage({ params }: Props) {
  const { id } = await params
  const [artist, songs] = await Promise.all([
    fetchArtistInfo(id),
    fetchArtistSongs(id),
  ])
  if (!artist) notFound()

  // Translate artist description (cached in DB)
  let bioKo: string | null = null
  if (artist.description) {
    const cached = await prisma.artistCache.findUnique({ where: { genius_artist_id: id } })
    if (cached?.description_ko) {
      bioKo = cached.description_ko
    } else {
      try {
        bioKo = await translateText(artist.description)
        await prisma.artistCache.upsert({
          where: { genius_artist_id: id },
          create: { genius_artist_id: id, description_ko: bioKo },
          update: { description_ko: bioKo },
        })
      } catch {
        bioKo = null
      }
    }
  }

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>

      {/* ── Hero ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          padding: '40px max(16px, calc(50vw - 566px)) 32px',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, transparent 100%)',
        }}
      >
        {artist.image_url && (
          <img
            src={artist.image_url}
            alt={artist.name}
            style={{
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            아티스트
          </p>
          <h1
            style={{
              margin: '0 0 12px',
              fontSize: 'clamp(28px, 6vw, 52px)',
              fontWeight: 400,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            {artist.name}
          </h1>
          {(bioKo || artist.description) && (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '640px' }}>
              {bioKo ?? artist.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Albums ─────────────────────────────────────── */}
      <AlbumsSection artistName={artist.name} artistId={id} songIds={songs.map((s) => s.genius_id)} />

      {/* ── Popular songs ──────────────────────────────── */}
      {songs.length > 0 && (
        <section style={{ paddingTop: '32px' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 'var(--text-xl)', fontWeight: 400, color: 'var(--text)' }}>
            인기 곡
          </h2>
          <ArtistSongs artistId={id} initialSongs={songs} />
        </section>
      )}
    </div>
  )
}
