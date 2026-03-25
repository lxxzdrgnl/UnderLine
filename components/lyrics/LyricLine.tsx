'use client'

import type { LyricLineData } from '@/types'

interface Props {
  line: LyricLineData
  isSelected: boolean
  onClick: () => void
}

export function LyricLine({ line, isSelected, onClick }: Props) {
  const isSection = /^\[.+\]$/.test(line.original.trim())

  if (isSection) {
    return (
      <div
        style={{
          marginTop: '24px',
          marginBottom: '8px',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
        }}
      >
        {line.original}
      </div>
    )
  }

  const hasInterpretation = !!(line.slang || line.explanation)

  return (
    <div
      onClick={hasInterpretation ? onClick : undefined}
      style={{ padding: '3px 0', cursor: hasInterpretation ? 'pointer' : 'default' }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 'var(--text-md)',
          lineHeight: 1.65,
          color: isSelected ? 'var(--accent)' : 'var(--text)',
          fontWeight: isSelected ? 500 : 400,
          transition: 'color 120ms ease',
        }}
      >
        {line.original}
        {hasInterpretation && (
          <span
            style={{
              display: 'inline-block',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: isSelected ? 'var(--accent)' : 'var(--border-strong)',
              marginLeft: '6px',
              verticalAlign: 'middle',
              marginBottom: '2px',
              transition: 'background 120ms ease',
            }}
          />
        )}
      </p>
      {line.translation && (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--text-sm)',
            lineHeight: 1.5,
            color: 'var(--text-muted)',
          }}
        >
          {line.translation}
        </p>
      )}
    </div>
  )
}
