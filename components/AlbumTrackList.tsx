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
      <h2
        style={{
          margin: '0 0 4px',
          fontSize: 'var(--text-lg)',
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontWeight: 400,
          color: 'var(--text)',
        }}
      >
        앨범 수록곡
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
        {tracks.length}곡
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {tracks.map((track) => {
          const isCurrent = track.genius_id === currentGeniusId
          return (
            <a
              key={track.genius_id}
              href={`/songs/${track.genius_id}`}
              className="hover-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                textDecoration: 'none',
                transition: 'background 120ms',
                borderLeft: isCurrent ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <span
                style={{
                  width: '20px',
                  textAlign: 'right',
                  flexShrink: 0,
                  fontSize: 'var(--text-sm)',
                  color: isCurrent ? 'var(--accent)' : 'var(--text-faint)',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {track.track_number}
              </span>

              {track.image_url && (
                <img
                  src={track.image_url}
                  alt=""
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--r-sm)',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: '0 0 2px',
                    fontSize: 'var(--text-sm)',
                    fontWeight: isCurrent ? 600 : 400,
                    color: isCurrent ? 'var(--text)' : 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {track.title}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-faint)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {track.artist}
                </p>
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
