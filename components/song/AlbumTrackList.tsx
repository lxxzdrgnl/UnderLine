import { fetchAlbumTracks } from '@/lib/genius'

interface Props {
  albumId: string
  currentGeniusId?: string
}

export async function AlbumTrackList({ albumId, currentGeniusId }: Props) {
  const tracks = await fetchAlbumTracks(albumId)
  if (tracks.length === 0) return null

  return (
    <section style={{ padding: '32px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--text-lg)',
            fontWeight: 400,
            color: 'var(--text)',
          }}
        >
          앨범 수록곡
        </h2>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
          {tracks.length}곡
        </span>
      </div>

      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
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
                padding: '10px 16px',
                textDecoration: 'none',
                transition: 'background 120ms',
                borderBottom: idx < tracks.length - 1 ? '1px solid var(--border)' : 'none',
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

              {track.image_url && (
                <img
                  src={track.image_url}
                  alt=""
                  style={{
                    width: '36px', height: '36px',
                    borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0,
                  }}
                />
              )}

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
