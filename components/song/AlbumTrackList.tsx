import Link from 'next/link'
import { fetchAlbumTracks, fetchAlbumDetail } from '@/lib/genius'

interface Props {
  albumId: string
  currentGeniusId?: string
}

export async function AlbumTrackList({ albumId, currentGeniusId }: Props) {
  const [tracks, album] = await Promise.all([
    fetchAlbumTracks(albumId),
    fetchAlbumDetail(albumId),
  ])
  if (tracks.length === 0) return null

  return (
    <section style={{ padding: '32px 0', borderTop: '1px solid var(--border)' }}>

      {/* Album header card */}
      <Link
        href={`/albums/${albumId}`}
        style={{
          display: 'flex', alignItems: 'center', gap: '16px',
          padding: '16px', marginBottom: '12px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          borderRadius: 'var(--r-lg)',
          textDecoration: 'none', transition: 'background 150ms',
        }}
        className="hover-row"
      >
        {album?.cover_art_url && (
          <img
            src={album.cover_art_url}
            alt=""
            style={{
              width: '56px', height: '56px',
              borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            앨범
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {album?.name ?? '앨범'}
          </p>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', flexShrink: 0 }}>
          {tracks.length}곡
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </Link>

      {/* Track list */}
      <div style={{
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
      }}>
        {tracks.map((track, idx) => {
          const isCurrent = track.genius_id === currentGeniusId
          return (
            <a
              key={track.genius_id}
              href={`/songs/${track.genius_id}`}
              className="hover-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '8px 12px',
                textDecoration: 'none',
                transition: 'background 120ms',
                borderRadius: 'var(--r-sm)',
                background: isCurrent ? 'var(--accent-bg)' : 'transparent',
              }}
            >
              <span
                style={{
                  width: '22px',
                  textAlign: 'center',
                  flexShrink: 0,
                  fontSize: 'var(--text-sm)',
                  color: isCurrent ? 'var(--accent)' : 'var(--text-faint)',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {isCurrent ? (
                  <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'flex-end', height: '14px' }}>
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-block',
                          width: '3px',
                          background: 'var(--accent)',
                          borderRadius: '1px',
                          animation: `eq-bar 0.4s ${i * 0.12}s ease infinite alternate`,
                          height: '60%',
                        }}
                      />
                    ))}
                  </span>
                ) : (
                  track.track_number
                )}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-sm)',
                    fontWeight: isCurrent ? 600 : 400,
                    color: isCurrent ? 'var(--accent)' : 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {track.title}
                </p>
                {track.artist && (
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-faint)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {track.artist}
                  </p>
                )}
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
