import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { stripRomanized, isGeniusRomanizations } from '@/lib/strings'
import { getOrCreateSong } from '@/lib/songs'
import Link from 'next/link'
import { LyricsView } from '@/components/lyrics/LyricsView'
import { AlbumTrackList } from '@/components/song/AlbumTrackList'
import { FavoriteButton } from '@/components/playlist/FavoriteButton'
import { TranslatedDescription } from '@/components/song/TranslatedDescription'

interface Props {
  params: Promise<{ id: string }>
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

function TrackListSkeleton() {
  return (
    <div style={{ padding: '32px 0', borderTop: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ width: '120px', height: '18px', marginBottom: '20px' }} />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 0' }}>
          <div className="skeleton" style={{ width: '20px', height: '14px', flexShrink: 0 }} />
          <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: 'var(--r-sm)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: '60%', height: '14px', marginBottom: '6px' }} />
            <div className="skeleton" style={{ width: '40%', height: '12px' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Strip Genius-specific tags from artist names
function cleanArtistName(name: string): string {
  let s = name
  // Remove (KOR), (USA) etc.
  s = s.replace(/\s*\(KOR\)/gi, '')
  // Remove (Ft. ...) including nested parens like (Ft. PENOMECO (페노메코))
  s = s.replace(/\s*\(Ft\..*$/i, '')
  return s.trim()
}

type FeaturedArtist = { id: string; name: string; type?: string }

function parseFeaturedArtists(raw: unknown): FeaturedArtist[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (a): a is FeaturedArtist =>
      typeof a === 'object' && a !== null &&
      typeof (a as FeaturedArtist).id === 'string' &&
      typeof (a as FeaturedArtist).name === 'string'
  )
}

export default async function SongPage({ params }: Props) {
  const { id } = await params
  const song = await getOrCreateSong(id)
  if (!song) notFound()

  const ytId = song.youtube_url ? getYouTubeId(song.youtube_url) : null
  const featuredArtists = parseFeaturedArtists(song.featured_artists)
    .map((fa) => ({ ...fa, name: cleanArtistName(fa.name) }))
  const displayTitle = stripRomanized(song.title)
  const displayArtist = cleanArtistName(
    isGeniusRomanizations(song.artist)
      ? displayTitle.match(/^(.+?)\s*[-–]\s*/)?.[1]?.trim() ?? song.artist
      : song.artist
  )
  const displayDescription = song.description === '?' ? null : song.description
  const cachedTranslation = song.description_ko ?? null

  const primaryArtists = featuredArtists.filter((fa) => fa.type === 'primary')
  const trueFeaturedArtists = featuredArtists.filter((fa) => fa.type === 'featured')

  const streamingLinks = [
    song.spotify_url && { label: 'Spotify', url: song.spotify_url, color: '#1DB954' },
    song.apple_music_url && { label: 'Apple Music', url: song.apple_music_url, color: '#FC3C44' },
  ].filter(Boolean) as { label: string; url: string; color: string }[]

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '0', overflow: 'visible' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '24px',
          padding: '32px max(16px, calc(50vw - 566px)) 24px',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, transparent 100%)',
        }}
      >
        {/* Album art */}
        {(song.album_image_url ?? song.image_url) && (
          <img
            src={(song.album_image_url ?? song.image_url)!}
            alt=""
            className="hover-scale"
            style={{
              width: '120px',
              height: '120px',
              borderRadius: 'var(--r-xl)',
              objectFit: 'cover',
              flexShrink: 0,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              transition: 'transform 200ms var(--ease)',
            }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1
              style={{
                margin: '0 0 8px',
                fontSize: 'clamp(22px, 4vw, 36px)',
                fontWeight: 400,
                color: 'var(--text)',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              {displayTitle}
            </h1>
            <FavoriteButton songId={song.id} />
          </div>

          {/* Artists */}
          <p style={{ margin: '0 0 6px', fontSize: 'var(--text-base)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {primaryArtists.map((a, i) => (
              <span key={a.id}>
                {i > 0 && <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>&amp;</span>}
                <Link href={`/artists/${a.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                  {cleanArtistName(a.name)}
                </Link>
              </span>
            ))}
            {primaryArtists.length === 0 && (
              song.genius_artist_id
                ? <Link href={`/artists/${song.genius_artist_id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>{displayArtist}</Link>
                : <span>{displayArtist}</span>
            )}
            {trueFeaturedArtists.length > 0 && (
              <span style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)', marginLeft: '6px' }}>
                {'feat. '}
                {trueFeaturedArtists.map((fa, i) => (
                  <span key={fa.id}>
                    <Link href={`/artists/${fa.id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
                      {cleanArtistName(fa.name)}
                    </Link>
                    {i < trueFeaturedArtists.length - 1 && <span style={{ color: 'var(--text-faint)', margin: '0 4px' }}>&amp;</span>}
                  </span>
                ))}
              </span>
            )}
          </p>

          {/* Album + release date */}
          {(song.album || song.release_date) && (
            <div style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--text-faint)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {song.album && (
                <span>
                  {song.genius_album_id ? (
                    <Link
                      href={`/albums/${song.genius_album_id}`}
                      style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                    >
                      {song.album}
                    </Link>
                  ) : (
                    song.album
                  )}
                </span>
              )}
              {song.release_date && <span>{song.release_date}</span>}
            </div>
          )}

          {/* Streaming badges */}
          {streamingLinks.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {streamingLinks.map(({ label, url, color }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 12px',
                    borderRadius: 'var(--r-sm)',
                    border: `1px solid ${color}40`,
                    background: `${color}12`,
                    color,
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textDecoration: 'none',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Description ────────────────────────────────── */}
      {displayDescription && (
        <TranslatedDescription text={displayDescription} songId={song.id} cached={cachedTranslation} />
      )}

      {/* ── Lyrics ─────────────────────────────────────── */}
      <div style={{ flex: 1 }}>
        <LyricsView songId={song.id} />
      </div>

      {/* ── YouTube embed ──────────────────────────────── */}
      {ytId && (
        <section style={{ padding: '32px 0', borderTop: '1px solid var(--border)' }}>
          <h2
            style={{
              margin: '0 0 16px',
              fontSize: 'var(--text-lg)',
              fontWeight: 400,
              color: 'var(--text)',
            }}
          >
            뮤직비디오
          </h2>
          <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#000' }}>
            <iframe
              src={`https://www.youtube.com/embed/${ytId}`}
              loading="lazy"
              style={{
                width: '100%',
                aspectRatio: '16/9',
                border: 'none',
                display: 'block',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {/* ── Album track list ───────────────────────────── */}
      {song.genius_album_id && (
        <Suspense fallback={<TrackListSkeleton />}>
          <AlbumTrackList albumId={song.genius_album_id} currentGeniusId={song.genius_id} />
        </Suspense>
      )}
    </div>
  )
}
