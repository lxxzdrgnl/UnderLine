export default function ArtistLoading() {
  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      {/* Hero skeleton — centered layout with banner bg */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        gap: '20px', padding: '80px max(16px, calc(50vw - 566px)) 32px',
        marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)',
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(to top, var(--bg) 0%, rgba(255,255,255,0.03) 100%)',
      }}>
        <div className="skeleton" style={{ width: '160px', height: '160px', borderRadius: '50%' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div className="skeleton" style={{ width: '60px', height: '12px' }} />
          <div className="skeleton" style={{ width: '220px', height: '42px' }} />
          <div className="skeleton" style={{ width: '160px', height: '12px' }} />
          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
          </div>
        </div>
      </div>

      {/* Bio skeleton */}
      <div style={{ padding: '24px 0 0' }}>
        <div className="skeleton" style={{ width: '100%', height: '14px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '80%', height: '14px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '50px', height: '12px' }} />
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
