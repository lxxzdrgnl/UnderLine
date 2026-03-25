'use client'

import type { LyricLineData } from '@/types'

interface Props {
  line: LyricLineData | null
  onClose?: () => void
  mode: 'panel' | 'modal'
}

export function InterpretationPanel({ line, onClose, mode }: Props) {
  const content = line ? (
    <div className="interp-content">
      <p className="interp-original">{line.original}</p>

      {line.translation && (
        <p className="interp-translation">{line.translation}</p>
      )}

      {line.slang && (
        <div className="interp-card interp-card--slang">
          <p className="interp-card-label interp-card-label--slang">슬랭</p>
          <p className="interp-card-body">{line.slang}</p>
        </div>
      )}

      {line.explanation && (
        <div className="interp-card interp-card--explain">
          <p className="interp-card-label interp-card-label--explain">해석</p>
          <p className="interp-card-body">{line.explanation}</p>
        </div>
      )}
    </div>
  ) : (
    mode === 'panel' ? (
      <div className="interp-empty">줄을 클릭하면 해석이 나타납니다</div>
    ) : null
  )

  if (mode === 'modal') {
    if (!line) return null
    return (
      <div className="interp-overlay" onClick={onClose}>
        <div className="interp-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="interp-handle"><div className="interp-handle-bar" /></div>
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
