# Playlist / Favorites & Recents & Search Page — Design Spec
Date: 2026-03-25
Revision: 3

## Overview

Features being added:
1. **찜하기 (Playlist/Favorites)** — save songs to named playlists from the song detail page
2. **Recents page** — date-grouped view of search history
3. **Nav dropdown** — replace direct profile link with a dropdown menu
4. **Search page** — `/search` with tabs: Songs / Artists / Albums
5. **Playlist ordering** — drag-and-drop reorder within a playlist
6. **Spotify import** — pick a Spotify playlist and import it as a local playlist

---

## 1. Data Model

### New models

```prisma
model Playlist {
  id        String         @id @default(cuid())
  userId    String
  name      String
  isDefault Boolean        @default(false)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  songs     PlaylistSong[]

  @@unique([userId, name])
  @@index([userId])
}

model PlaylistSong {
  id         String   @id @default(cuid())
  playlistId String
  songId     String
  position   Int      // 0-based; set on insert and updated on reorder
  addedAt    DateTime @default(now())
  playlist   Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  song       Song     @relation(fields: [songId], references: [id], onDelete: Cascade)

  @@unique([playlistId, songId])
  @@index([playlistId, position])
}
```

**Note**: `position` has no unique constraint; duplicate positions are possible after concurrent inserts (see §2). Reorder normalises positions. The `@@index([playlistId, position])` covers ordered fetches.

### Back-relations
- `User` gains `playlists Playlist[]`
- `Song` gains `playlistSongs PlaylistSong[]` (camelCase, matching other back-relations on `Song`: `raw`, `lines`)

### SearchHistory change
Add `updatedAt DateTime @updatedAt` to the existing `SearchHistory` model.

**Handler changes in `app/api/user/search-history/route.ts`:**
- `POST` upsert: remove `update: { created_at: new Date(), ... }`. `updatedAt` is auto-bumped by Prisma on any update.
- `GET` handler: change `orderBy: { created_at: 'desc' }` → `orderBy: { updatedAt: 'desc' }` so that re-visited songs bubble to the top in the NowPlaying history dropdown and in the recents page.

### Business rules
- **Default playlist auto-create on first save**: wrap creation in a try/catch; catch Prisma P2002 on `@@unique([userId, name])` and treat as no-op (use `findFirst` to return the already-existing default playlist).
- **Position on insert**: run inside a `$transaction` — lock the playlist row with `findUnique` then assign `position = current count`. Prevents duplicate positions under concurrent inserts.
- **Position on delete**: no gap-fill; positions become non-contiguous. The reorder endpoint normalises positions when called.
- Max 50 playlists per user enforced at API level.
- Same song can exist in multiple playlists; cannot be duplicated within the same playlist (`@@unique([playlistId, songId])`).

---

## 2. API Routes

All routes call `const session = await auth()` directly; return 401 if null.
Playlist ownership: `playlist.userId !== session.user.id` → 403 `{ error: "forbidden" }`. Missing playlist → 404.

### Playlists

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/playlists` | User's playlists with song count. Returns `{ playlists, count }` |
| POST | `/api/playlists` | Create `{ name }`. 422 `{ error: "playlist_name_taken" }` or `{ error: "playlist_limit_reached", limitReached: true }` |
| DELETE | `/api/playlists/[id]` | 403 `{ error: "default_playlist" }` if default; 403 `{ error: "forbidden" }` if wrong owner |

### Playlist Songs

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/playlists/[id]/songs` | Ordered by `position ASC`. Full song metadata |
| POST | `/api/playlists/[id]/songs` | Add `{ songId }`. Idempotent (200 if already present). Position assigned inside `$transaction` |
| DELETE | `/api/playlists/[id]/songs/[songId]` | Remove. 404 if not in playlist |
| PUT | `/api/playlists/[id]/songs/reorder` | Body: `{ order: string[] }` (all songIds in new position order). **422 if `order.length !== playlist song count`** or any songId not in playlist. Updates all positions in a single `$transaction` |

**Note on routing**: `app/api/playlists/[id]/songs/reorder/route.ts` and `app/api/playlists/[id]/songs/[songId]/route.ts` coexist at the same level. In Next.js App Router, a literal segment (`reorder`) takes priority over a dynamic segment (`[songId]`). This is valid and intentional.

### Song ↔ Playlist lookup

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/songs/[id]/playlists` | `{ playlistIds: string[] }` for logged-in user. 401 if not logged in |

### Search

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/search?q=&type=songs\|artists\|albums` | Calls `searchSongs(q)` for all types. `songs`: return hits as-is. `artists`: deduplicate by `primary_artist.id`, return `{ id, name, image_url }`. `albums`: deduplicate by `album.id`, return `{ id, name, cover_art_url, artist }`. Up to 10 results. No auth required |

### Spotify Import

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/spotify/playlists` | User's Spotify playlists (name, id, track count, image). 403 `{ error: "spotify_not_linked" }` if no linked Spotify account |
| POST | `/api/playlists/import/spotify` | Body: `{ spotifyPlaylistId, name? }`. Fetches ALL tracks (paginated from Spotify API), searches each on Genius, creates playlist. Returns `{ playlistId, imported, skipped, total }`. Playlist limit checked first (422 before starting) |

#### Spotify import implementation
- Fetch **all tracks** from Spotify playlist via pagination (100 per page)
- For each track: call `searchSongs(title + " " + artist)`, take first hit, upsert `Song`, create `PlaylistSong`
- Genius search parallelised with concurrency limit of 5 (`Promise.all` batches)
- Tracks with no Genius match: skip, count in `skipped`
- Name: use provided `name` or Spotify playlist name; if taken, append " (가져오기)"
- `position` assigned in Spotify playlist order

---

## 3. Pages & Routes

### `/search`
- Public (no auth required)
- Three tabs: **Songs** · **Artists** · **Albums** — tab state in URL: `/search?q=...&type=songs` (default: `songs`)
- Search input at top, debounced 300ms, min 2 characters before fetching
- Calls `GET /api/search?q=...&type=...`
- Results:
  - **Songs**: thumbnail, title, artist → `/songs/[genius_id]`
  - **Artists**: image, name → `/artists/[genius_artist_id]`
  - **Albums**: cover, title, artist → `/albums/[genius_album_id]`
- Empty state per tab: "검색 결과가 없어요"
- Client component

### `/recents`
- **Auth required** — `redirect('/login')` if no session
- Fetches `SearchHistory` ordered by `updatedAt DESC`
- Date grouping: "오늘" / "어제" / "2026-03-02"
- Each entry → `/songs/[genius_id]`
- Empty state: "아직 검색 기록이 없어요"

### `/playlists`
- **Auth required** — `redirect('/login')` if no session
- Grid of playlist cards: cover (first song image or placeholder), name, song count
- "내 찜 목록" pinned first, no delete button
- "새 플레이리스트": disabled at 50 with caption
- "Spotify에서 가져오기": shown only if Spotify account linked; opens import modal
- Empty state: "찜한 곡이 없어요 — 노래 페이지에서 저장해보세요"

### `/playlists/[id]`
- **Auth required** — `redirect('/login')` if no session
- Ownership mismatch or not found → `notFound()`
- Song list ordered by `position ASC`
- Drag-and-drop reorder (drag handle per row); on drop → `PUT reorder`
- "제거" button per song
- Delete playlist button in header: hidden for default playlist
- Empty state: "아직 저장된 곡이 없어요"

### Spotify Import Modal (inside `/playlists`)
- Fetches `GET /api/spotify/playlists` on open
- User selects one playlist (name, track count shown)
- Optional name input (pre-filled with Spotify playlist name)
- Confirm → `POST /api/playlists/import/spotify` → loading spinner → result summary
- On success: navigate to new playlist

---

## 4. Navigation

### Avatar dropdown
```
[아바타]
 ├── Recents       → /recents
 ├── 플레이리스트  → /playlists
 └── 설정          → /profile
```
- Server layout passes `session.user` as props to `<UserDropdown user={session.user} />` (`'use client'`)
- Closes on outside `mousedown`
- z-index above NowPlaying

### Nav link
Add **"검색"** link in main header → `/search`.

---

## 5. Song Detail — Favorites Button

- Hidden if unauthenticated (401 from `GET /api/songs/[id]/playlists`)
- Hollow heart = not saved; filled green = saved in ≥1 playlist
- Skeleton while fetching initial state
- Click → modal: checkbox per playlist, immediate POST/DELETE on toggle
- DELETE failure → revert + toast
- "새 플레이리스트": disabled at 50 limit

---

## 6. Limit Enforcement

| Location | At 50 playlists |
|----------|-----------------|
| `/playlists` | "새 플레이리스트" disabled + caption |
| Favorites modal | "새 플레이리스트" disabled + inline text |
| Spotify import modal | "가져오기" disabled + inline text |
| `POST /api/playlists` | 422 `{ error: "playlist_limit_reached", limitReached: true }` |
| `POST /api/playlists/import/spotify` | 422 before stream starts |

---

## 7. New lib functions

### `lib/spotify.ts`
```ts
export async function getSpotifyPlaylists(userId: string): Promise<SpotifyPlaylist[]>
export async function getSpotifyPlaylistTracks(userId: string, playlistId: string): Promise<SpotifyTrack[]>
```
Both reuse the existing token-refresh pattern from `getNowPlaying`.

---

## 8. Files to Create / Modify

### New
- `app/(main)/search/page.tsx`
- `app/(main)/recents/page.tsx`
- `app/(main)/playlists/page.tsx`
- `app/(main)/playlists/[id]/page.tsx`
- `app/api/search/route.ts`
- `app/api/playlists/route.ts`
- `app/api/playlists/[id]/route.ts`
- `app/api/playlists/[id]/songs/route.ts`
- `app/api/playlists/[id]/songs/[songId]/route.ts`
- `app/api/playlists/[id]/songs/reorder/route.ts`
- `app/api/playlists/import/spotify/route.ts`
- `app/api/songs/[id]/playlists/route.ts`
- `app/api/spotify/playlists/route.ts`
- `components/nav/UserDropdown.tsx`
- `components/playlist/FavoriteButton.tsx`
- `components/playlist/FavoriteModal.tsx`
- `components/playlist/SpotifyImportModal.tsx`

### Modified
- `prisma/schema.prisma`
- `app/api/user/search-history/route.ts` — remove `created_at: new Date()`, change `orderBy` to `updatedAt`
- `lib/spotify.ts` — add `getSpotifyPlaylists`, `getSpotifyPlaylistTracks`
- `app/(main)/layout.tsx` — `<UserDropdown>`; add "검색" nav link
- `app/(main)/songs/[id]/page.tsx` — add `<FavoriteButton>`

---

## 9. Design Guidelines

All new pages and components follow the existing visual system. No Tailwind utility classes — use inline styles with CSS variables from `app/globals.css`.

### CSS Variables (reference)
| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#121212` | Page background |
| `--bg-surface` | `#181818` | Card / panel background |
| `--bg-subtle` | `#282828` | Hover states, dividers |
| `--bg-elevated` | `#3E3E3E` | Tooltips, popovers |
| `--text` | `#FFFFFF` | Primary text |
| `--text-muted` | `#B3B3B3` | Secondary text |
| `--text-faint` | `#727272` | Labels, captions |
| `--border` | `#282828` | Default border |
| `--border-strong` | `#3E3E3E` | Strong border |
| `--accent` | `#1DB954` | Green accent (Spotify) |
| `--accent-bg` | `rgba(29,185,84,0.12)` | Accent tint background |
| `--r-sm/md/lg/xl` | `4/8/12/16px` | Border radii |
| `--text-xs…2xl` | `11–28px` | Typography scale |
| `--ease`, `--dur` | cubic-bezier / 150ms | Transitions |

### Utility classes (available globally)
- `.page-enter` — fade-up entrance animation (use on page root div)
- `.skeleton` — shimmer loading placeholder
- `.hover-row` — row hover background (`--bg-subtle`)
- `.hover-dim` — opacity hover
- `.spinner` — loading spinner

### Typography
- Headings: `font-family: 'DM Serif Display', Georgia, serif`
- Body: `font-family: 'IBM Plex Sans', system-ui, sans-serif`

### Page structure pattern (match existing pages)
```tsx
<div className="page-enter" style={{ paddingBottom: '64px' }}>
  <h1 style={{ fontFamily: "'DM Serif Display'...", fontSize: 'var(--text-2xl)', ... }}>
    페이지 제목
  </h1>
  {/* content */}
</div>
```

### Card pattern (playlist cards, song rows)
- Background: `var(--bg-surface)`
- Border-radius: `var(--r-md)` or `var(--r-lg)`
- Hover: `var(--bg-subtle)` via `.hover-row`
- Song thumbnails: `borderRadius: 'var(--r-sm)'`, `objectFit: 'cover'`

---

## 10. Out of Scope
- Playlist cover image customisation
- Sharing playlists publicly
- Spotify import progress streaming (synchronous response is sufficient)
- Artist/album dedicated Genius search API (reuse `searchSongs`, extract from hits)
