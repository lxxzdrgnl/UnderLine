'use client'

import { useEffect, useState } from 'react'

const KNOWN_PROVIDERS: { id: string; label: string; color: string }[] = [
  { id: 'google', label: 'Google', color: '#4285F4' },
  { id: 'spotify', label: 'Spotify', color: '#1DB954' },
  // { id: 'kakao', label: '카카오', color: '#FEE500' },
  // { id: 'naver', label: '네이버', color: '#03C75A' },
]

export default function LinkedAccounts() {
  const [connected, setConnected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user/accounts')
      .then((r) => r.json())
      .then((d) => { setConnected(d.providers ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const result = p.get('link')
    if (!result) return
    const map: Record<string, string> = {
      success: '계정이 성공적으로 연결되었습니다.',
      merged: '두 계정이 병합되었습니다.',
      already: '이미 연결된 계정입니다.',
      taken: '이미 다른 계정에 연결된 소셜 계정입니다.',
      cancelled: '연결이 취소되었습니다.',
    }
    setMsg(map[result] ?? null)
    window.history.replaceState({}, '', '/profile')
  }, [])

  const handleLink = (provider: string) => {
    window.location.href = `/api/oauth/${provider}`
  }

  const handleUnlink = async (provider: string) => {
    if (!confirm(`${provider} 연동을 해제할까요?`)) return
    const res = await fetch(`/api/user/accounts?provider=${provider}`, { method: 'DELETE' })
    if (res.ok) {
      setConnected((prev) => prev.filter((p) => p !== provider))
      setMsg('연동이 해제되었습니다. 새 scope로 다시 연결해주세요.')
    } else {
      const data = await res.json().catch(() => ({}))
      setMsg(data.message || '해제 실패')
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>로딩 중...</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{msg}</p>}
      {KNOWN_PROVIDERS.map(({ id, label, color }) => {
        const isLinked = connected.includes(id)
        return (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
              <span style={{ color, marginRight: 8 }}>●</span>
              {label}
            </span>
            {isLinked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>연결됨</span>
                <button
                  onClick={() => handleUnlink(id)}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-faint)',
                    cursor: 'pointer',
                  }}
                >
                  해제
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleLink(id)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                연결하기
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
