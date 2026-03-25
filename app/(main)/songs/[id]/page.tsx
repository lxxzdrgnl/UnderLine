import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fetchSongDetail } from '@/lib/genius'
import { stripRomanized, isGeniusRomanizations } from '@/lib/strings'
import { LyricsView } from '@/components/lyrics/LyricsView'
import { AlbumTrackList } from '@/components/song/AlbumTrackList'

interface Props {
  params: Promise<{ id: string }>
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

async function getSong(id: string) {
  // 1. Try by CUID (internal DB id)
  let song = await prisma.song.findUnique({ where: { id } })
  if (song) return song

  // 2. Try by Genius ID
  song = await prisma.song.findUnique({ where: { genius_id: id } })
  if (song) return song

  // 3. On-the-fly: numeric Genius ID → fetch + upsert
  if (/^\d+$/.test(id)) {
    const detail = await fetchSongDetail(id)
    if (!detail) return null
    song = await prisma.song.upsert({
      where: { genius_id: id },
      create: {
        genius_id: id,
        title: '(제목 없음)',
        artist: '',
        genius_path: '',
        album: detail.album,
        album_image_url: detail.album_image_url,
        release_date: detail.release_date,
        description: detail.description,
        spotify_url: detail.spotify_url,
        youtube_url: detail.youtube_url,
        apple_music_url: detail.apple_music_url,
        genius_artist_id: detail.genius_artist_id,
        genius_album_id: detail.genius_album_id,
        featured_artists: detail.featured_artists ?? [],
      },
      update: {
        album: detail.album,
        album_image_url: detail.album_image_url,
        release_date: detail.release_date,
        description: detail.description,
        spotify_url: detail.spotify_url,
        youtube_url: detail.youtube_url,
        apple_music_url: detail.apple_music_url,
        genius_artist_id: detail.genius_artist_id,
        genius_album_id: detail.genius_album_id,
        featured_artists: detail.featured_artists ?? [],
      },
    })
    return song
  }

  return null
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

type FeaturedArtist = { id: string; name: string }

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
  const song = await getSong(id)
  if (!song) notFound()

  const ytId = song.youtube_url ? getYouTubeId(song.youtube_url) : null
  const featuredArtists = parseFeaturedArtists(song.featured_artists)
  const displayTitle = stripRomanized(song.title)
  const displayArtist = isGeniusRomanizations(song.artist)
    ? displayTitle.match(/^(.+?)\s*[-–]\s*/)?.[1]?.trim() ?? song.artist
    : song.artist
  const displayDescription = song.description === '?' ? null : song.description

  const streamingLinks = [
    song.spotify_url && { label: 'Spotify', url: song.spotify_url, color: '#1DB954' },
    song.apple_music_url && { label: 'Apple Music', url: song.apple_music_url, color: '#FC3C44' },
  ].filter(Boolean) as { label: string; url: string; color: string }[]

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '24px',
          padding: '32px 0 24px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.025) 0%, transparent 100%)',
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
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 'clamp(22px, 4vw, 36px)',
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontWeight: 400,
              color: 'var(--text)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            {displayTitle}
          </h1>

          {/* Artist + feat. */}
          <p style={{ margin: '0 0 6px', fontSize: 'var(--text-base)', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
            {song.genius_artist_id ? (
              <a href={`/artists/${song.genius_artist_id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                {displayArtist.split(/\s+feat\.\s+/i)[0]}
              </a>
            ) : (
              <span>{displayArtist.split(/\s+feat\.\s+/i)[0]}</span>
            )}
            {featuredArtists.length > 0 && (
              <>
                <span style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>feat.</span>
                {featuredArtists.map((fa, i) => (
                  <span key={fa.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <a href={`/artists/${fa.id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
                      {fa.name}
                    </a>
                    {i < featuredArtists.length - 1 && <span style={{ color: 'var(--text-faint)' }}>,</span>}
                  </span>
                ))}
              </>
            )}
          </p>

          {/* Album + release date */}
          {(song.album || song.release_date) && (
            <p style={{ margin: '0 0 14px', fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
              {song.genius_album_id && song.album ? (
                <a
                  href={`/albums/${song.genius_album_id}`}
                  style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                >
                  {song.album}
                </a>
              ) : (
                song.album
              )}
              {song.album && song.release_date && ' · '}
              {song.release_date}
            </p>
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
        <p
          style={{
            margin: 0,
            padding: '16px 0',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            lineHeight: 1.7,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {displayDescription}
        </p>
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
              fontFamily: "'DM Serif Display', Georgia, serif",
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
