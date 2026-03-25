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
      <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-zinc-400">
        {line.original}
      </div>
    )
  }

  const hasInterpretation = !!(line.slang || line.explanation)

  return (
    <div
      onClick={hasInterpretation ? onClick : undefined}
      className={`group py-1 ${hasInterpretation ? 'cursor-pointer' : ''}`}
    >
      <p
        className={[
          'text-base leading-relaxed transition-colors',
          hasInterpretation ? 'group-hover:text-zinc-500' : '',
          isSelected ? 'font-medium' : 'text-zinc-900 dark:text-zinc-100',
        ].join(' ')}
      >
        {line.original}
        {hasInterpretation && (
          <span className="ml-1 text-xs text-zinc-300 dark:text-zinc-600">•</span>
        )}
      </p>
      {line.translation && (
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {line.translation}
        </p>
      )}
    </div>
  )
}
