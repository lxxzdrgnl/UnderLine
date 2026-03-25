'use client'

import type { LyricLineData } from '@/types'

interface Props {
  line: LyricLineData | null
  onClose?: () => void
  mode: 'panel' | 'modal'
}

export function InterpretationPanel({ line, onClose, mode }: Props) {
  const content = line ? (
    <div style={{ padding: '16px' }}>
      <p
        style={{
          margin: '0 0 16px',
          fontSize: 'var(--text-lg)',
          fontWeight: 500,
          lineHeight: 1.6,
          color: 'var(--text)',
        }}
      >
        {line.original}
      </p>
      {line.translation && (
        <p style={{ margin: '0 0 16px', fontSize: 'var(--text-base)', color: 'var(--text-muted)' }}>
          {line.translation}
        </p>
      )}
      {line.slang && (
        <div
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--accent-bg)',
            padding: '12px 16px',
            marginBottom: '12px',
            border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          }}
        >
          <p
            style={{
              margin: '0 0 6px',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
            }}
          >
            슬랭
          </p>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text)', lineHeight: 1.6 }}>
            {line.slang}
          </p>
        </div>
      )}
      {line.explanation && (
        <div
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--bg-surface)',
            padding: '12px 16px',
            border: '1px solid var(--border)',
          }}
        >
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.7, color: 'var(--text)' }}>
            {line.explanation}
          </p>
        </div>
      )}
    </div>
  ) : (
    mode === 'panel' ? (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          fontSize: '13px',
          color: 'var(--text-faint)',
          textAlign: 'center',
        }}
      >
        줄을 클릭하면 해석이 나타납니다
      </div>
    ) : null
  )

  if (mode === 'modal') {
    if (!line) return null
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'flex-end',
          background: 'rgba(0,0,0,0.4)',
        }}
        onClick={onClose}
      >
        <div
          style={{
            maxHeight: '70vh',
            width: '100%',
            overflowY: 'auto',
            borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
            background: 'var(--bg)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '16px',
              }}
            >
              ✕
            </button>
          </div>
          {content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {content}
    </div>
  )
}
