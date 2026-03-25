export default function SongLoading() {
  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      {/* Hero skeleton */}
      <div style={{ display: 'flex', gap: '24px', padding: '32px 0', alignItems: 'flex-end' }}>
        <div className="skeleton" style={{ width: '200px', height: '200px', borderRadius: 'var(--r-lg)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '50px', height: '12px', marginBottom: '10px' }} />
          <div className="skeleton" style={{ width: '250px', height: '32px', marginBottom: '10px' }} />
          <div className="skeleton" style={{ width: '150px', height: '16px' }} />
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
