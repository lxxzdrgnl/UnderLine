'use client'

import { useState, useEffect, useCallback } from 'react'
import { LyricLine } from './LyricLine'
import { InterpretationPanel } from './InterpretationPanel'
import type { LyricLineData } from '@/types'

type Status = 'loading' | 'processing' | 'streaming' | 'done' | 'error'

export function LyricsView({ songId }: { songId: string }) {
  const [lines, setLines] = useState<LyricLineData[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [selectedLine, setSelectedLine] = useState<LyricLineData | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadLyrics = useCallback(async () => {
    setStatus('loading')
    setLines([])

    const res = await fetch(`/api/songs/${songId}/lyrics`)

    if (res.status === 202) {
      setStatus('processing')
      setTimeout(loadLyrics, 3000)
      return
    }

    if (!res.ok || !res.body) {
      setStatus('error')
      return
    }

    setStatus('streaming')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.trim()) continue
          try {
            const obj = JSON.parse(part)
            if (obj.error) { setStatus('error'); return }
            setLines((prev) => [...prev, {
              line_number: obj.line,
              original: obj.original,
              translation: obj.translation,
              slang: obj.slang,
              explanation: obj.explanation,
            }])
          } catch { /* ignore parse failures */ }
        }
      }
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [songId])

  useEffect(() => { loadLyrics() }, [loadLyrics])

  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-zinc-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        <p className="text-sm">다른 사용자가 이 곡을 처리 중입니다. 잠시 후 자동으로 업데이트됩니다.</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-zinc-500">
        <p>가사를 불러오는 데 실패했습니다.</p>
        <button
          onClick={loadLyrics}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full gap-8">
        <div className={`overflow-y-auto ${isMobile ? 'w-full' : 'w-3/5'}`}>
          {status === 'loading' && (
            <div className="space-y-3 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
          )}
          <div className="space-y-0.5 py-4">
            {lines.map((line) => (
              <LyricLine
                key={line.line_number}
                line={line}
                isSelected={selectedLine?.line_number === line.line_number}
                onClick={() => setSelectedLine(line)}
              />
            ))}
          </div>
        </div>

        {!isMobile && (
          <div className="w-2/5 border-l border-zinc-100 dark:border-zinc-800">
            <InterpretationPanel line={selectedLine} mode="panel" />
          </div>
        )}
      </div>

      {isMobile && (
        <InterpretationPanel
          line={selectedLine}
          mode="modal"
          onClose={() => setSelectedLine(null)}
        />
      )}
    </>
  )
}
