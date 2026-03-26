export default function SongLoading() {
  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      {/* Hero skeleton */}
      <div style={{
        display: 'flex', gap: '24px', padding: '32px 16px 24px', alignItems: 'flex-start',
        marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="skeleton" style={{ width: '120px', height: '120px', borderRadius: 'var(--r-xl)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="skeleton" style={{ width: '60%', height: '28px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ width: '40%', height: '14px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '30%', height: '12px' }} />
        </div>
      </div>
      {/* Lyrics skeleton */}
      <div style={{ paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '16px', width: `${60 + (i % 3) * 15}%` }} />
        ))}
      </div>
    </div>
  )
}
