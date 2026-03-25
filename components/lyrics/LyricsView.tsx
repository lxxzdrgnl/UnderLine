'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { LyricLine } from './LyricLine'
import { InterpretationPanel } from './InterpretationPanel'
import type { LyricLineData } from '@/types'

type Status = 'loading' | 'processing' | 'streaming' | 'done' | 'error'

export function LyricsView({ songId }: { songId: string }) {
  const [lines, setLines] = useState<LyricLineData[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [selectedLine, setSelectedLine] = useState<LyricLineData | null>(null)
  const [panelTop, setPanelTop] = useState(0)
  const [clampedTop, setClampedTop] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelColRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const loadLyrics = useCallback(async () => {
    // Cancel any in-flight request and pending retry
    abortRef.current?.abort()
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)

    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setLines([])

    let res: Response
    try {
      res = await fetch(`/api/songs/${songId}/lyrics`, { signal: controller.signal })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setStatus('error')
      return
    }

    if (res.status === 202) {
      setStatus('processing')
      retryTimerRef.current = setTimeout(loadLyrics, 3000)
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
            setLines((prev) => {
              // Deduplicate by line_number to guard against race conditions
              if (prev.some((l) => l.line_number === obj.line)) return prev
              return [...prev, {
                line_number: obj.line,
                original: obj.original,
                translation: obj.translation,
                slang: obj.slang,
                explanation: obj.explanation,
              }]
            })
          } catch { /* ignore parse failures */ }
        }
      }
      setStatus('done')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setStatus('error')
    }
  }, [songId])

  useEffect(() => {
    loadLyrics()
    return () => {
      abortRef.current?.abort()
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [loadLyrics])

  if (status === 'processing') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          padding: '80px 0',
          color: 'var(--text-muted)',
        }}
      >
        <div className="spinner" />
        <p style={{ margin: 0, fontSize: '13px' }}>
          다른 사용자가 이 곡을 처리 중입니다. 잠시 후 자동으로 업데이트됩니다.
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '80px 0',
          color: 'var(--text-muted)',
        }}
      >
        <p style={{ margin: 0 }}>가사를 불러오는 데 실패했습니다.</p>
        <button
          onClick={loadLyrics}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 16px',
            borderRadius: 'var(--r-sm)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            border: 'none',
            background: 'var(--accent)',
            color: '#000',
          }}
        >
          다시 시도
        </button>
      </div>
    )
  }

  const handleLineClick = (line: LyricLineData) => {
    if (selectedLine?.line_number === line.line_number) {
      setSelectedLine(null)
      return
    }
    const el = lineRefs.current.get(line.line_number)
    if (el) setPanelTop(el.offsetTop)
    setSelectedLine(line)
  }

  // Clamp panel so it doesn't overflow the parent column
  useEffect(() => {
    if (!panelRef.current || !panelColRef.current || !selectedLine) return
    const parentH = panelColRef.current.clientHeight
    const panelH = panelRef.current.clientHeight
    if (panelTop + panelH > parentH) {
      setClampedTop(Math.max(0, parentH - panelH))
    } else {
      setClampedTop(panelTop)
    }
  }, [panelTop, selectedLine])

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, flexWrap: 'nowrap', position: 'relative' }}>
      {/* 가사 컬럼 */}
      <div className="lyrics-col">
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: '16px', width: `${60 + (i % 3) * 15}%` }}
              />
            ))}
          </div>
        )}
        {lines.map((line) => (
          <div
            key={line.line_number}
            ref={(el) => {
              if (el) lineRefs.current.set(line.line_number, el)
              else lineRefs.current.delete(line.line_number)
            }}
          >
            <LyricLine
              line={line}
              isSelected={selectedLine?.line_number === line.line_number}
              onClick={() => handleLineClick(line)}
            />
            {selectedLine?.line_number === line.line_number && (
              <div
                className="lyrics-inline-panel"
                style={{
                  margin: '4px 0 12px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  overflow: 'hidden',
                }}
              >
                <InterpretationPanel line={line} mode="panel" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 패널 컬럼 */}
      <div
        ref={panelColRef}
        className="lyrics-panel-col"
        style={{
          flex: '0 0 42%',
          position: 'relative',
          alignSelf: 'stretch',
          borderLeft: '1px solid var(--border)',
        }}
      >
        {selectedLine && (
          <div
            ref={panelRef}
            style={{
              position: 'absolute',
              top: clampedTop,
              left: 0,
              right: 0,
              transition: 'top 150ms var(--ease)',
            }}
          >
            <InterpretationPanel line={selectedLine} mode="panel" />
          </div>
        )}
        {!selectedLine && (
          <InterpretationPanel line={null} mode="panel" />
        )}
      </div>
    </div>
  )
}
