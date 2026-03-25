# Codebase Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate repeating patterns by extracting shared utilities and hooks — only where real duplication exists and extraction reduces complexity.

**Architecture:** Server-side utilities first (spotify token, songs upsert, auth session), then client hooks (modal dismiss, lyrics stream). Each task is independent and can be verified in isolation.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, React hooks

---

## File Map

**Create:**
- `hooks/useModalDismiss.ts` — backdrop click + ESC dismiss hook
- `hooks/useLyricsStream.ts` — streaming fetch + NDJSON parse + abort/retry

**Modify:**
- `lib/spotify.ts` — extract `getValidSpotifyToken()`, remove 3 duplicate blocks
- `lib/songs.ts` — deduplicate upsert create/update fields with shared object
- `lib/auth-guard.ts` — replace `requireAuth` guard with `requireSession(req) → { session, error }`; keep `withAdmin`
- `app/api/**` — 14 route files: replace manual `auth()` + null check with `requireSession`
- `components/playlist/FavoriteModal.tsx` — apply `useModalDismiss`
- `components/playlist/SpotifyImportModal.tsx` — apply `useModalDismiss`
- `components/nav/UserDropdown.tsx` — apply `useModalDismiss`
- `components/lyrics/LyricsView.tsx` — apply `useLyricsStream`, keep only UI logic

---

## Task 1: Extract `getValidSpotifyToken` in `lib/spotify.ts`

**Files:**
- Modify: `lib/spotify.ts`

Lines 51–57, 98–104, 150–156 are identical. The only difference is the fallback return value (`null` vs `[]`) — handle at call site.

- [ ] Add after `refreshSpotifyToken`:

```typescript
async function getValidSpotifyToken(
  account: { id: string; access_token: string | null; refresh_token: string | null; expires_at: number | null }
): Promise<string | null> {
  if (!account.access_token) return null
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 30) {
    if (!account.refresh_token) return null
    return refreshSpotifyToken(account.id, account.refresh_token)
  }
  return account.access_token
}
```

- [ ] Replace each of the 3 duplicate blocks. Example for `getNowPlaying` (same pattern for the other two):

```typescript
// BEFORE
let token = account.access_token
if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 30) {
  if (!account.refresh_token) return null
  const refreshed = await refreshSpotifyToken(account.id, account.refresh_token)
  if (!refreshed) return null
  token = refreshed
}

// AFTER
const token = await getValidSpotifyToken(account)
if (!token) return null  // (or return [] in the list functions)
```

- [ ] `npx tsc --noEmit 2>&1 | grep -v __tests__` — expect no errors

- [ ] Commit:
```bash
git add lib/spotify.ts
git commit -m "refactor: extract getValidSpotifyToken, remove 3 duplicate token refresh blocks"
```

---

## Task 2: Deduplicate upsert fields in `lib/songs.ts`

**Files:**
- Modify: `lib/songs.ts`

`create` and `update` objects in the upsert share 10 identical fields. Adding a field today requires editing both.

- [ ] In `getOrCreateSong` step 3, extract before the upsert call:

```typescript
const detailData = {
  album: detail.album,
  album_image_url: detail.album_image_url,
  release_date: detail.release_date,
  description: detail.description,
  spotify_url: detail.spotify_url,
  youtube_url: detail.youtube_url,
  apple_music_url: detail.apple_music_url,
  genius_artist_id: detail.genius_artist_id,
  genius_album_id: detail.genius_album_id,
  featured_artists: detail.featured_artists ?? [],
}

return prisma.song.upsert({
  where: { genius_id: id },
  create: {
    genius_id: id,
    title: stripRomanized(detail.title),
    artist: detail.artist,
    image_url: detail.image_url,
    genius_path: detail.genius_path,
    ...detailData,
  },
  update: detailData,
})
```

- [ ] Apply the same to step 2 (`prisma.song.update`):

```typescript
const detailData = {
  album: detail.album,
  album_image_url: detail.album_image_url,
  release_date: detail.release_date,
  description: detail.description,
  spotify_url: detail.spotify_url,
  youtube_url: detail.youtube_url,
  apple_music_url: detail.apple_music_url,
  genius_artist_id: detail.genius_artist_id,
  genius_album_id: detail.genius_album_id,
  featured_artists: detail.featured_artists ?? [],
}
song = await prisma.song.update({ where: { id: song.id }, data: detailData })
```

- [ ] `npx tsc --noEmit 2>&1 | grep -v __tests__` — expect no errors

- [ ] Commit:
```bash
git add lib/songs.ts
git commit -m "refactor: deduplicate song detail fields in songs.ts upsert"
```

---

## Task 3: Replace auth guard with `requireSession` in `lib/auth-guard.ts`

**Files:**
- Modify: `lib/auth-guard.ts`

Current `requireAuth` only guards (returns error or null) but routes still call `auth()` again to get `userId`. Replace with a function that returns both the session and the error response in one call.

- [ ] Replace `requireAuth` in `lib/auth-guard.ts`:

```typescript
// REMOVE requireAuth (old guard-only pattern)
// ADD:
export async function requireSession(req: NextRequest): Promise<
  | { session: { user: { id: string; role?: string } }; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      session: null,
      error: NextResponse.json(
        apiError(req.nextUrl.pathname, 401, 'UNAUTHORIZED'),
        { status: 401 }
      ),
    }
  }
  return { session: session as { user: { id: string; role?: string } }, error: null }
}
```

Keep `requireAdmin` and `withAdmin` unchanged.

- [ ] `npx tsc --noEmit 2>&1 | grep -v __tests__` — expect no errors

- [ ] Commit:
```bash
git add lib/auth-guard.ts
git commit -m "refactor: add requireSession returning { session, error } to auth-guard"
```

---

## Task 4: Apply `requireSession` across API routes

**Files:** 12 route files

Pattern to apply in each file:

```typescript
// BEFORE
const session = await auth()
if (!session?.user?.id) return Response.json(null, { status: 401 })
const userId = session.user.id

// AFTER
const { session, error } = await requireSession(req)
if (error) return error
const userId = session.user.id
```

Routes to update (one by one — run tsc after each file):

- [ ] `app/api/user/search-history/route.ts`
- [ ] `app/api/user/profile/route.ts`
- [ ] `app/api/user/accounts/route.ts`
- [ ] `app/api/playlists/route.ts`
- [ ] `app/api/playlists/[id]/route.ts`
- [ ] `app/api/playlists/[id]/songs/route.ts`
- [ ] `app/api/playlists/[id]/songs/[songId]/route.ts`
- [ ] `app/api/playlists/[id]/songs/reorder/route.ts`
- [ ] `app/api/playlists/import/spotify/route.ts`
- [ ] `app/api/spotify/now-playing/route.ts`
- [ ] `app/api/spotify/playlists/route.ts`
- [ ] `app/api/songs/[id]/playlists/route.ts`

- [ ] Final: `npx tsc --noEmit 2>&1 | grep -v __tests__` — expect no errors

- [ ] Commit:
```bash
git add app/api/
git commit -m "refactor: apply requireSession across all authenticated API routes"
```

---

## Task 5: Create `hooks/useModalDismiss.ts`

**Files:**
- Create: `hooks/useModalDismiss.ts`

Exact same `useEffect` (mousedown outside + ESC) in `FavoriteModal`, `SpotifyImportModal`, `UserDropdown`.

- [ ] Create `hooks/useModalDismiss.ts`:

```typescript
import { useEffect, type RefObject } from 'react'

/**
 * Calls onDismiss when user clicks outside `ref` element or presses Escape.
 */
export function useModalDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, onDismiss, enabled])
}
```

- [ ] Apply to `components/playlist/FavoriteModal.tsx`:
  - Add: `import { useModalDismiss } from '@/hooks/useModalDismiss'`
  - Remove the `useEffect` block with mousedown/Escape (lines ~45–53)
  - Add: `useModalDismiss(ref, onClose)`

- [ ] Apply to `components/playlist/SpotifyImportModal.tsx`:
  - Same — remove the `useEffect`, add `useModalDismiss(ref, onClose)`

- [ ] Apply to `components/nav/UserDropdown.tsx`:
  - Same — remove the `useEffect`, add `useModalDismiss(ref, () => setOpen(false))`

- [ ] `npx tsc --noEmit 2>&1 | grep -v __tests__` — expect no errors

- [ ] Commit:
```bash
git add hooks/useModalDismiss.ts components/playlist/FavoriteModal.tsx components/playlist/SpotifyImportModal.tsx components/nav/UserDropdown.tsx
git commit -m "refactor: extract useModalDismiss hook, apply to modals and dropdown"
```

---

## Task 6: Extract `useLyricsStream` from `LyricsView.tsx`

**Files:**
- Create: `hooks/useLyricsStream.ts`
- Modify: `components/lyrics/LyricsView.tsx`

`LyricsView` (272 lines) bundles streaming fetch + NDJSON parsing + abort controller + retry timer with the lyrics UI. The data-fetching logic is self-contained and UI-independent.

- [ ] Create `hooks/useLyricsStream.ts`:

```typescript
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
```

- [ ] Update `LyricsView.tsx`:
  - Remove: `lines`, `status` state; `loadLyrics` callback; fetch/stream/abort/retry logic; `useEffect` that calls `loadLyrics`; `Status` type
  - Add: `import { useLyricsStream } from '@/hooks/useLyricsStream'`
  - Add: `const { lines, status, retry } = useLyricsStream(songId)`
  - Replace `loadLyrics` references with `retry` (the retry button `onClick`)
  - Keep: panel positioning state (`selectedLine`, `panelTop`, `clampedTop`), clamp `useEffect`, all rendering logic

- [ ] `npx tsc --noEmit 2>&1 | grep -v __tests__` — expect no errors

- [ ] Commit:
```bash
git add hooks/useLyricsStream.ts components/lyrics/LyricsView.tsx
git commit -m "refactor: extract useLyricsStream hook from LyricsView"
```

---

## Task 7: Squash commits + update AGENTS.md

- [ ] Squash all refactoring commits:
```bash
git log --oneline   # count commits since last feature commit
git reset --soft HEAD~N
git commit -m "refactor: extract shared utilities and hooks

- getValidSpotifyToken: remove 3 duplicate token refresh blocks in spotify.ts
- songs.ts: deduplicate upsert create/update fields via shared detailData object
- auth-guard: add requireSession() returning { session, error } for clean route auth
- useModalDismiss: extract backdrop+ESC hook, apply to FavoriteModal/SpotifyImportModal/UserDropdown
- useLyricsStream: extract streaming fetch/NDJSON/abort/retry from LyricsView"
```

- [ ] Append to `AGENTS.md`:

```markdown
## Shared Patterns

### Auth — `lib/auth-guard.ts`
- Authenticated routes: `const { session, error } = await requireSession(req); if (error) return error`
- Admin routes: use `withAdmin(handler)` HOF
- Never call `auth()` directly in route handlers

### Spotify token — `lib/spotify.ts`
- Use internal `getValidSpotifyToken(account)` → `string | null`
- Returns null if missing/expired and refresh fails; caller returns early

### Song upsert — `lib/songs.ts`
- `upsertSongFromSearchResult(result)` — create from search result (basic fields, no detail)
- `getOrCreateSong(id)` — find by CUID or genius_id, fills detail lazily, creates from numeric genius_id
- When adding new detail fields: update `detailData` object only (used in both create spread and update)

### Modal dismiss — `hooks/useModalDismiss.ts`
- `useModalDismiss(ref, onDismiss)` — attaches mousedown outside + ESC listeners
- Use for any floating panel, modal, or dropdown that should dismiss on outside click

### Lyrics streaming — `hooks/useLyricsStream.ts`
- `useLyricsStream(songId)` → `{ lines, status, retry }`
- Handles fetch, NDJSON parse, abort, 202 retry, no_lyrics, error states
- LyricsView owns only UI (panel positioning, click handlers, rendering)
```

- [ ] Commit:
```bash
git add AGENTS.md
git commit -m "docs: document shared patterns in AGENTS.md"
```

---

## Verification

- [ ] `npx tsc --noEmit 2>&1 | grep -v __tests__` — zero errors
- [ ] `npm run test:run` — all tests pass
- [ ] Manually: home search → song, search page → song, playlist → song all load with correct title/artist
- [ ] Manually: FavoriteModal, SpotifyImportModal close on ESC + outside click
- [ ] Manually: lyrics page loads, streams, retry button works
