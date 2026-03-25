'use client'

import type { LyricLineData } from '@/types'

interface Props {
  line: LyricLineData | null
  onClose?: () => void
  mode: 'panel' | 'modal'
}

export function InterpretationPanel({ line, onClose, mode }: Props) {
  const content = line ? (
    <div className="space-y-4 p-6">
      <p className="text-lg font-medium leading-relaxed">{line.original}</p>
      {line.translation && (
        <p className="text-zinc-500 dark:text-zinc-400">{line.translation}</p>
      )}
      {line.slang && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            슬랭
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-200">{line.slang}</p>
        </div>
      )}
      {line.explanation && (
        <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {line.explanation}
          </p>
        </div>
      )}
    </div>
  ) : (
    mode === 'panel' ? (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        줄을 클릭하면 해석이 나타납니다
      </div>
    ) : null
  )

  if (mode === 'modal') {
    if (!line) return null
    return (
      <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
        <div
          className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-end p-2">
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600">✕</button>
          </div>
          {content}
        </div>
      </div>
    )
  }

  return <div className="h-full overflow-y-auto">{content}</div>
}
