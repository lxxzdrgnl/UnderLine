'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { LyricLineData } from '@/types'

export type LyricsStatus = 'loading' | 'processing' | 'streaming' | 'done' | 'error' | 'empty'

export function useLyricsStream(songId: string) {
  const [lines, setLines] = useState<LyricLineData[]>([])
  const [status, setStatus] = useState<LyricsStatus>('loading')
  const abortRef = useRef<AbortController | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
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
      retryTimerRef.current = setTimeout(load, 3000)
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
            if (obj.no_lyrics) { setStatus('empty'); return }
            if (obj.error) { setStatus('error'); return }
            setLines((prev) => {
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
    load()
    return () => {
      abortRef.current?.abort()
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [load])

  return { lines, status, retry: load }
}
