export default function ArtistLoading() {
  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      {/* Hero skeleton */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '28px',
        padding: '40px 0 32px', borderBottom: '1px solid var(--border)',
      }}>
        <div className="skeleton" style={{ width: '140px', height: '140px', borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '60px', height: '12px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ width: '200px', height: '36px', marginBottom: '12px' }} />
          <div className="skeleton" style={{ width: '80%', height: '14px' }} />
        </div>
      </div>

      {/* Albums skeleton */}
      <div style={{ paddingTop: '32px' }}>
        <div className="skeleton" style={{ width: '60px', height: '22px', marginBottom: '20px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '20px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--r-md)', marginBottom: '10px' }} />
              <div className="skeleton" style={{ width: '80%', height: '14px', marginBottom: '4px' }} />
              <div className="skeleton" style={{ width: '50%', height: '12px' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Songs skeleton */}
      <div style={{ paddingTop: '32px' }}>
        <div className="skeleton" style={{ width: '80px', height: '22px', marginBottom: '20px' }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 12px' }}>
            <div className="skeleton" style={{ width: '20px', height: '14px' }} />
            <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '60%', height: '14px', marginBottom: '4px' }} />
              <div className="skeleton" style={{ width: '40%', height: '12px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
