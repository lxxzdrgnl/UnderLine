export default function AlbumLoading() {
  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: '28px',
        padding: '40px max(16px, calc(50vw - 566px)) 32px',
        marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="skeleton" style={{ width: '180px', height: '180px', borderRadius: 'var(--r-xl)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '40px', height: '12px', marginBottom: '10px' }} />
          <div className="skeleton" style={{ width: '220px', height: '32px', marginBottom: '10px' }} />
          <div className="skeleton" style={{ width: '150px', height: '14px' }} />
        </div>
      </div>
      <div style={{ paddingTop: '24px' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 12px' }}>
            <div className="skeleton" style={{ width: '24px', height: '14px' }} />
            <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '50%', height: '14px', marginBottom: '4px' }} />
              <div className="skeleton" style={{ width: '30%', height: '12px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
