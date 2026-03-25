import LoginButtons from './LoginButtons'

export default function LoginPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '40px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            margin: '0 0 8px',
            fontSize: '26px',
            fontWeight: 400,
            color: 'var(--text)',
          }}
        >
          로그인
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
          계속하려면 계정으로 로그인하세요
        </p>
      </div>

      <LoginButtons />
    </div>
  )
}
