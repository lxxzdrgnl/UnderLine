import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchArtistInfo, fetchArtistSongs, fetchSongDetail, searchSongs } from '@/lib/genius'
import { translateText } from '@/lib/gpt'
import { fetchSpotifyArtistAlbums } from '@/lib/spotify'
import { prisma } from '@/lib/prisma'
import { ArtistSongs } from './ArtistSongs'
import { ArtistBio } from './ArtistBio'
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
        className="artist-hero"
        style={{
          position: 'relative',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          borderBottom: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* Background banner */}
        {artist.header_image_url && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${artist.header_image_url})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            opacity: 0.15, filter: 'blur(20px) saturate(1.2)',
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, var(--bg) 0%, transparent 60%)',
        }} />

        <div
          style={{
            position: 'relative',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            gap: '20px',
            padding: '80px max(16px, calc(50vw - 566px)) 32px',
          }}
        >
          {artist.image_url && (
            <img
              src={artist.image_url}
              alt={artist.name}
              className="artist-hero-img"
              style={{
                width: '160px', height: '160px',
                borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
                border: '3px solid rgba(255,255,255,0.1)',
              }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              아티스트
            </p>
            <h1
              style={{
                margin: '0 0 8px',
                fontSize: 'clamp(32px, 7vw, 56px)',
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap',
              }}
            >
              {artist.name}
              {artist.is_verified && (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--accent)" stroke="none" style={{ flexShrink: 0 }}>
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              )}
            </h1>

            {/* Alternate names */}
            {artist.alternate_names.length > 0 && (
              <p style={{ margin: '0 0 12px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                a.k.a. {artist.alternate_names.slice(0, 4).join(' · ')}
              </p>
            )}

            {/* Social links */}
            {Object.keys(artist.social_links).length > 0 && (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {artist.social_links.instagram && (
                  <a href={`https://instagram.com/${artist.social_links.instagram}`} target="_blank" rel="noopener noreferrer" className="nav-icon-btn" style={{ color: 'var(--text-faint)', display: 'flex', opacity: 0.6, transition: 'opacity 150ms' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  </a>
                )}
                {artist.social_links.twitter && (
                  <a href={`https://x.com/${artist.social_links.twitter}`} target="_blank" rel="noopener noreferrer" className="nav-icon-btn" style={{ color: 'var(--text-faint)', display: 'flex', opacity: 0.6, transition: 'opacity 150ms' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                )}
                {artist.social_links.facebook && (
                  <a href={`https://facebook.com/${artist.social_links.facebook}`} target="_blank" rel="noopener noreferrer" className="nav-icon-btn" style={{ color: 'var(--text-faint)', display: 'flex', opacity: 0.6, transition: 'opacity 150ms' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bio ──────────────────────────────────────── */}
      {(bioKo || artist.description) && (
        <div style={{ padding: '24px 0 0' }}>
          <ArtistBio text={bioKo ?? artist.description!} />
        </div>
      )}

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
