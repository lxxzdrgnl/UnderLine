<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Shared Patterns

### Auth — `lib/auth-guard.ts`
- Authenticated routes: `const { session, error } = await requireSession(req); if (error) return error`
- Admin routes: use `withAdmin(handler)` HOF
- Never call `auth()` directly in route handlers

### Spotify token — `lib/spotify.ts`
- Use internal `getValidSpotifyToken(account)` → `string | null`
- Returns null if token missing/expired and refresh fails; caller returns early

### Song upsert — `lib/songs.ts`
- `upsertSongFromSearchResult(result)` — create from search result (basic fields, no detail fetch)
- `getOrCreateSong(id)` — find by CUID or genius_id, fills detail lazily, creates from numeric genius_id
- When adding new detail fields: update `detailData` object only (shared between create spread and update)

### Modal dismiss — `hooks/useModalDismiss.ts`
- `useModalDismiss(ref, onDismiss, enabled?)` — attaches mousedown outside + ESC listeners
- Use for any floating panel, modal, or dropdown that should close on outside interaction

### Internal navigation — always use `<Link>` from `next/link`
- Never use `<a href="...">` for internal routes — it causes full page reload and blocks navigation until the server responds
- Use `<Link href="...">` for all `/artists/`, `/songs/`, `/albums/`, `/playlists/`, `/recents/`, `/profile/`, `/settings/` links
- `<Link>` triggers instant client-side navigation and shows `loading.tsx` skeleton immediately
- `<a>` is only correct for external URLs (http/https) and `mailto:`

### Lyrics streaming — `hooks/useLyricsStream.ts`
- `useLyricsStream(songId)` → `{ lines, status, retry }`
- Handles fetch, NDJSON parse, abort, 202 retry, no_lyrics, error states
- LyricsView owns only UI (panel positioning, click handlers, rendering)
