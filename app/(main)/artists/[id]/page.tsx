import { notFound } from 'next/navigation'
import { fetchArtistInfo, fetchArtistSongs } from '@/lib/genius'

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
          padding: '40px 0 32px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.025) 0%, transparent 100%)',
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
              fontFamily: "'DM Serif Display', Georgia, serif",
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

      {/* ── Popular songs ──────────────────────────────── */}
      {songs.length > 0 && (
        <section style={{ paddingTop: '32px' }}>
          <h2
            style={{
              margin: '0 0 20px',
              fontSize: 'var(--text-xl)',
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontWeight: 400,
              color: 'var(--text)',
            }}
          >
            인기 곡
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {songs.map((song, idx) => (
              <a
                key={song.genius_id}
                href={`/songs/${song.genius_id}`}
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
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
