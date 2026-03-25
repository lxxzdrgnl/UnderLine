'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { GeniusSearchResult } from '@/types'

interface SearchResult extends GeniusSearchResult {
  db_id: string | null
  lyrics_status: string | null
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 2) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/songs/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results ?? [])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelect = async (result: SearchResult) => {
    let songId = result.db_id
    if (!songId) {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      })
      const data = await res.json()
      songId = data.id
    }
    router.push(`/songs/${songId}`)
  }

  return (
    <div className="relative w-full max-w-2xl">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="어떤 곡의 숨겨진 의미가 궁금하신가요?"
        className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-lg shadow-sm outline-none focus:border-zinc-400 dark:bg-zinc-900 dark:border-zinc-700"
      />
      {loading && (
        <div className="absolute right-4 top-4 text-sm text-zinc-400">검색 중...</div>
      )}
      {results.length > 0 && (
        <ul className="absolute top-full z-10 mt-2 w-full rounded-xl border bg-white shadow-lg dark:bg-zinc-900 dark:border-zinc-700">
          {results.map((r) => (
            <li
              key={r.genius_id}
              onClick={() => handleSelect(r)}
              className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {r.image_url && (
                <img src={r.image_url} alt="" className="h-10 w-10 rounded object-cover" />
              )}
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-zinc-500">{r.artist}</p>
              </div>
              {r.lyrics_status === 'DONE' && (
                <span className="ml-auto text-xs text-green-500">해석 완료</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
