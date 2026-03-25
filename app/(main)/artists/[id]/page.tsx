import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchArtistInfo, fetchArtistSongs, fetchSongDetail } from '@/lib/genius'
import { fetchSpotifyArtistAlbums } from '@/lib/spotify'
import { prisma } from '@/lib/prisma'
import { SongLink } from '@/components/SongLink'

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

  // If DB has few albums, fetch song details to discover more
  if (albumMap.size < 3 && songIds.length > 0) {
    const details = await Promise.all(
      songIds.slice(0, 10).map((id) => fetchSongDetail(id).catch(() => null))
    )
    for (const d of details) {
      if (d?.genius_album_id && d.album && !albumMap.has(d.album.toLowerCase())) {
        albumMap.set(d.album.toLowerCase(), { id: d.genius_album_id, name: d.album, image: d.album_image_url ?? null })
      }
    }
  }

  // 2. Get Spotify albums for cover art + release dates
  const spotifyAlbums = await fetchSpotifyArtistAlbums(artistName)

  // 3. Build final list: prefer Spotify image, use Genius ID for linking
  type AlbumItem = { id: string; name: string; image_url: string | null; release_date: string | null; href: string }
  const albums: AlbumItem[] = []
  const seen = new Set<string>()

  // Spotify albums matched with Genius IDs
  for (const sa of spotifyAlbums) {
    const match = albumMap.get(sa.name.toLowerCase())
    if (match && !seen.has(match.id)) {
      seen.add(match.id)
      albums.push({ id: match.id, name: sa.name, image_url: sa.image_url, release_date: sa.release_date, href: `/albums/${match.id}` })
    }
  }

  // DB albums not matched by Spotify
  for (const [, a] of albumMap) {
    if (!seen.has(a.id)) {
      seen.add(a.id)
      albums.push({ id: a.id, name: a.name, image_url: a.image ?? null, release_date: null, href: `/albums/${a.id}` })
    }
  }

  // Spotify-only albums (no Genius match) — link to search
  for (const sa of spotifyAlbums) {
    if (!albums.some((a) => a.name.toLowerCase() === sa.name.toLowerCase())) {
      albums.push({ id: sa.id, name: sa.name, image_url: sa.image_url, release_date: sa.release_date, href: `/search?q=${encodeURIComponent(sa.name + ' ' + artistName)}&type=albums` })
    }
  }

  if (albums.length === 0) return null

  return (
    <section style={{ paddingTop: '32px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 'var(--text-xl)', fontWeight: 400, color: 'var(--text)' }}>
        앨범
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '20px',
      }}>
        {albums.map((album) => (
          <Link
            key={album.id}
            href={album.href}
            style={{ textDecoration: 'none', transition: 'opacity 150ms' }}
            className="hover-dim"
          >
            <div style={{
              width: '100%', aspectRatio: '1', borderRadius: 'var(--r-md)',
              overflow: 'hidden', background: 'var(--bg-subtle)', marginBottom: '10px',
            }}>
              {album.image_url ? (
                <img src={album.image_url} alt={album.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '24px' }}>♪</div>
              )}
            </div>
            <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {album.name}
            </p>
            {album.release_date && (
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                {album.release_date}
              </p>
            )}
          </Link>
        ))}
      </div>
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

  const bio = artist.description
    ? artist.description.length > 300
      ? artist.description.slice(0, 300) + '…'
      : artist.description
    : null

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
          {bio && (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '640px' }}>
              {bio}
            </p>
          )}
        </div>
      </div>

      {/* ── Albums ─────────────────────────────────────── */}
      <AlbumsSection artistName={artist.name} artistId={id} songIds={songs.map((s) => s.genius_id)} />

      {/* ── Popular songs ──────────────────────────────── */}
      {songs.length > 0 && (
        <section style={{ paddingTop: '32px' }}>
          <h2
            style={{
              margin: '0 0 20px',
              fontSize: 'var(--text-xl)',
              fontWeight: 400,
              color: 'var(--text)',
            }}
          >
            인기 곡
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {songs.map((song, idx) => (
              <SongLink
                key={song.genius_id}
                song={song}
                className="hover-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '10px 12px',
                  borderRadius: 'var(--r-md)',
                  textDecoration: 'none',
                  transition: 'background 120ms',
                }}
              >
                <span style={{ width: '20px', textAlign: 'right', flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
                  {idx + 1}
                </span>
                {song.image_url && (
                  <img
                    src={song.image_url}
                    alt=""
                    style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {song.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {song.artist}
                  </p>
                </div>
              </SongLink>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
