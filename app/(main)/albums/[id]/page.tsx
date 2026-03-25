import { notFound } from 'next/navigation'
import { fetchAlbumDetail, fetchAlbumTracks } from '@/lib/genius'
import { SongLink } from '@/components/SongLink'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AlbumPage({ params }: Props) {
  const { id } = await params
  const [album, tracks] = await Promise.all([
    fetchAlbumDetail(id),
    fetchAlbumTracks(id),
  ])
  if (!album) notFound()

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '28px',
          padding: '40px max(16px, calc(50vw - 566px)) 32px',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.025) 0%, transparent 100%)',
        }}
      >
        {album.cover_art_url && (
          <img
            src={album.cover_art_url}
            alt={album.name}
            style={{
              width: '180px',
              height: '180px',
              borderRadius: 'var(--r-xl)',
              objectFit: 'cover',
              flexShrink: 0,
              boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
            }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0, paddingBottom: '4px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            앨범
          </p>
          <h1
            style={{
              margin: '0 0 10px',
              fontSize: 'clamp(22px, 4vw, 40px)',
              fontWeight: 400,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {album.name}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {album.genius_artist_id ? (
              <a href={`/artists/${album.genius_artist_id}`} style={{ fontSize: 'var(--text-sm)', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                {album.artist_name}
              </a>
            ) : (
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{album.artist_name}</span>
            )}
            {album.release_date && (
              <>
                <span style={{ color: 'var(--text-faint)', fontSize: 'var(--text-xs)' }}>·</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>{album.release_date}</span>
              </>
            )}
            {tracks.length > 0 && (
              <>
                <span style={{ color: 'var(--text-faint)', fontSize: 'var(--text-xs)' }}>·</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>{tracks.length}곡</span>
              </>
            )}
          </div>

          {album.description && (
            <p style={{ margin: '14px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '600px' }}>
              {album.description.length > 240 ? album.description.slice(0, 240) + '…' : album.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Track list ─────────────────────────────────── */}
      {tracks.length > 0 && (
        <section style={{ paddingTop: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tracks.map((track) => (
              <SongLink
                key={track.genius_id}
                song={track}
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
                <span style={{ width: '24px', textAlign: 'right', flexShrink: 0, fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
                  {track.track_number}
                </span>
                {track.image_url && (
                  <img src={track.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {track.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {track.artist}
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
