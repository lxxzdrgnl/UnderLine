import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { fetchArtistInfo, fetchArtistSongs, fetchSongDetail, fetchAlbumDetail, searchSongs } from '@/lib/genius'
import { translateText } from '@/lib/gpt'
import { fetchSpotifyArtistAlbums } from '@/lib/spotify'
import { prisma } from '@/lib/prisma'
import { ArtistSongs } from './ArtistSongs'
import { ArtistBio } from './ArtistBio'
import { AlbumGrid } from './AlbumGrid'

function BioSkeleton() {
  return (
    <div style={{ width: '100%', maxWidth: '640px', textAlign: 'center' }}>
      <div className="skeleton" style={{ width: '100%', height: '14px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '95%', height: '14px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '90%', height: '14px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '80%', height: '14px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ width: '50px', height: '12px' }} />
    </div>
  )
}

function AlbumsSkeleton() {
  return (
    <div style={{ paddingTop: '32px' }}>
      <div className="skeleton" style={{ width: '60px', height: '22px', marginBottom: '20px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '20px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-md)', marginBottom: '10px' }} />
            <div className="skeleton" style={{ width: '80%', height: '14px', marginBottom: '4px' }} />
            <div className="skeleton" style={{ width: '50%', height: '12px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Take the first N sentences from text, return them and the char offset where they end
function firstSentences(text: string, count: number): { first: string; offset: number } {
  let offset = 0
  let found = 0
  while (found < count && offset < text.length) {
    const next = text.indexOf('. ', offset)
    if (next === -1) { offset = text.length; break }
    offset = next + 2
    found++
  }
  return { first: text.slice(0, offset).trim(), offset }
}

async function BioSection({ id, description }: { id: string; description: string }) {
  const cached = await prisma.artistCache.findUnique({ where: { genius_artist_id: id } })

  const { first, offset } = firstSentences(description, 20)
  const hasMore = offset < description.length

  // Full translation cached
  if (cached?.description_ko) {
    return <ArtistBio text={cached.description_ko} />
  }

  // Preview cached — skip re-translation
  if (cached?.description_preview) {
    return (
      <ArtistBio
        text={cached.description_preview}
        artistId={hasMore ? id : undefined}
        originalOffset={hasMore ? offset : undefined}
      />
    )
  }

  let firstKo: string | null = null
  try {
    firstKo = await translateText(first)
  } catch {
    // translation failed — will show original English below
  }

  if (firstKo) {
    try {
      await prisma.artistCache.upsert({
        where: { genius_artist_id: id },
        create: { genius_artist_id: id, ...(!hasMore ? { description_ko: firstKo } : { description_preview: firstKo }) },
        update: {                        ...(!hasMore ? { description_ko: firstKo } : { description_preview: firstKo }) },
      })
    } catch {
      // cache failure is non-critical
    }
  }

  return (
    <ArtistBio
      text={firstKo ?? first}
      artistId={hasMore && firstKo ? id : undefined}
      originalOffset={hasMore && firstKo ? offset : undefined}
    />
  )
}

// Normalize partial dates ("2021" → "2021-01-01", "2021-03" → "2021-03-01") for consistent sorting
function normalizeDate(d: string | null): string | null {
  if (!d) return null
  if (/^\d{4}$/.test(d)) return `${d}-01-01`
  if (/^\d{4}-\d{2}$/.test(d)) return `${d}-01`
  return d
}

function sortByDateDesc<T extends { release_date: string | null }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const da = normalizeDate(a.release_date)
    const db = normalizeDate(b.release_date)
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return db.localeCompare(da)
  })
}

async function AlbumsSection({ artistName, artistId, page1Songs }: { artistName: string; artistId: string; page1Songs: { genius_id: string; artist: string }[] }) {
  try {
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

  // 2. Get Spotify albums for cover art + release dates (fall back to DB if unavailable)
  const spotifyAlbums = await fetchSpotifyArtistAlbums(artistName).catch(() => [])

  if (spotifyAlbums.length === 0) {
    // Spotify unavailable — pre-filter to primary-artist songs, fetch page 2 if needed, cap at 40
    const nameLower = artistName.toLowerCase()
    const isPrimary = (s: { artist: string }) => s.artist.toLowerCase().startsWith(nameLower)

    const seen = new Set(page1Songs.map((s) => s.genius_id))
    const primarySongs = page1Songs.filter(isPrimary)
    let page = 2
    while (primarySongs.length < 40 && page <= 5) {
      const more = await fetchArtistSongs(artistId, page).catch(() => [])
      if (more.length === 0) break
      for (const s of more) {
        if (!seen.has(s.genius_id)) {
          seen.add(s.genius_id)
          if (isPrimary(s)) primarySongs.push(s)
        }
      }
      page++
    }

    if (primarySongs.length > 0) {
      const capped = primarySongs.slice(0, 40)
      // Use DB first to avoid API calls for already-cached songs
      const dbCached = await prisma.song.findMany({
        where: { genius_id: { in: capped.map((s) => s.genius_id) }, genius_album_id: { not: null }, album: { not: null } },
        select: { genius_id: true, genius_album_id: true, album: true, album_image_url: true, genius_artist_id: true },
      })
      for (const s of dbCached) {
        if (s.album && s.genius_album_id && s.genius_artist_id === artistId && !albumMap.has(s.album.toLowerCase())) {
          albumMap.set(s.album.toLowerCase(), { id: s.genius_album_id, name: s.album, image: s.album_image_url })
        }
      }
      const cachedIds = new Set(dbCached.map((s) => s.genius_id))
      const uncached = capped.filter((s) => !cachedIds.has(s.genius_id))
      if (uncached.length > 0) {
        const details = await Promise.all(
          uncached.map((s) => fetchSongDetail(s.genius_id).catch(() => null))
        )
        for (const d of details) {
          if (d?.genius_album_id && d.album && d.genius_artist_id === artistId && !albumMap.has(d.album.toLowerCase())) {
            albumMap.set(d.album.toLowerCase(), { id: d.genius_album_id, name: d.album, image: d.album_image_url ?? null })
          }
        }
      }
    }
    if (albumMap.size === 0) return null

    // Fetch release dates from Genius album detail; skip albums not owned by this artist
    const albumsRaw = (await Promise.all(
      Array.from(albumMap.values()).map(async (a) => {
        const detail = await fetchAlbumDetail(a.id).catch(() => null)
        if (detail?.genius_artist_id && detail.genius_artist_id !== artistId) return null
        return { id: a.id, name: a.name, image_url: a.image, release_date: detail?.release_date ?? null, href: `/albums/${a.id}` }
      })
    )).filter((a): a is NonNullable<typeof a> => a !== null)
    const albumsWithDates = sortByDateDesc(albumsRaw)
    return (
      <section style={{ paddingTop: '32px' }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 'var(--text-xl)', fontWeight: 400, color: 'var(--text)' }}>앨범</h2>
        <AlbumGrid albums={albumsWithDates} />
      </section>
    )
  }

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

  const sortedAlbums = sortByDateDesc(albums)

  if (sortedAlbums.length === 0) return null

  return (
    <section style={{ paddingTop: '32px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 'var(--text-xl)', fontWeight: 400, color: 'var(--text)' }}>
        앨범
      </h2>
      <AlbumGrid albums={sortedAlbums} />
    </section>
  )
  } catch (e) {
    console.error('[AlbumsSection] error:', e)
    return null
  }
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

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>

      {/* Hero */}
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

      {/* Bio */}
      {artist.description && (
        <div style={{ padding: '24px 0 0', display: 'flex', justifyContent: 'center' }}>
          <Suspense fallback={<BioSkeleton />}>
            <BioSection id={id} description={artist.description} />
          </Suspense>
        </div>
      )}

      {/* Albums */}
      <Suspense fallback={<AlbumsSkeleton />}>
        <AlbumsSection artistName={artist.name} artistId={id} page1Songs={songs} />
      </Suspense>

      {/* Popular songs */}
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
