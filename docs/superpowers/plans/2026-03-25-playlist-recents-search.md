# Playlist, Recents & Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add playlist/favorites system, recents page, search page with artist/album tabs, nav dropdown, and Spotify playlist import.

**Architecture:** Prisma models (Playlist, PlaylistSong) + REST API routes + server/client components. All styling uses inline styles with CSS variables from `globals.css`. Auth via `await auth()` from NextAuth. Spotify import fetches all tracks via pagination, searches Genius with batched concurrency.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma + PostgreSQL, NextAuth, Spotify Web API, Genius API

**Spec:** `docs/superpowers/specs/2026-03-25-playlist-recents-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `app/api/playlists/route.ts` | GET list playlists, POST create playlist |
| `app/api/playlists/[id]/route.ts` | DELETE playlist |
| `app/api/playlists/[id]/songs/route.ts` | GET songs in playlist, POST add song |
| `app/api/playlists/[id]/songs/[songId]/route.ts` | DELETE remove song |
| `app/api/playlists/[id]/songs/reorder/route.ts` | PUT reorder songs |
| `app/api/playlists/import/spotify/route.ts` | POST import Spotify playlist |
| `app/api/songs/[id]/playlists/route.ts` | GET playlists containing this song |
| `app/api/search/route.ts` | GET unified search (songs/artists/albums) |
| `app/api/spotify/playlists/route.ts` | GET user's Spotify playlists |
| `app/(main)/search/page.tsx` | Search page with tabs |
| `app/(main)/recents/page.tsx` | Date-grouped search history |
| `app/(main)/playlists/page.tsx` | Playlist grid |
| `app/(main)/playlists/[id]/page.tsx` | Playlist detail with drag reorder |
| `components/nav/UserDropdown.tsx` | Avatar dropdown menu |
| `components/playlist/FavoriteButton.tsx` | Heart icon + modal trigger |
| `components/playlist/FavoriteModal.tsx` | Playlist checkbox modal |
| `components/playlist/SpotifyImportModal.tsx` | Spotify import flow |
| `app/(main)/playlists/PlaylistActions.tsx` | Client wrapper: create playlist + Spotify import buttons |
| `app/(main)/playlists/[id]/PlaylistSongList.tsx` | Client: drag-and-drop song list |
| `app/(main)/playlists/[id]/DeletePlaylistButton.tsx` | Client: delete playlist button |

### Modified files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add Playlist, PlaylistSong; add updatedAt to SearchHistory; back-relations |
| `app/api/user/search-history/route.ts` | Remove manual `created_at` update; sort by `updatedAt` |
| `lib/spotify.ts` | Add `getSpotifyPlaylists`, `getSpotifyPlaylistTracks` |
| `app/(main)/layout.tsx` | Replace avatar link with `<UserDropdown>`; add "검색" nav link |
| `app/(main)/songs/[id]/page.tsx` | Add `<FavoriteButton>` |
| `app/api/docs/route.ts` | Add new endpoints to Swagger spec |

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Playlist model to schema**

In `prisma/schema.prisma`, after the `SearchHistory` model, add:

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
  position   Int
  addedAt    DateTime @default(now())
  playlist   Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  song       Song     @relation(fields: [songId], references: [id], onDelete: Cascade)

  @@unique([playlistId, songId])
  @@index([playlistId, position])
}
```

- [ ] **Step 2: Add back-relations and updatedAt**

Add to `User` model (after `searchHistory` line):
```prisma
  playlists     Playlist[]
```

Add to `Song` model (after `lines` line):
```prisma
  playlistSongs PlaylistSong[]
```

Add to `SearchHistory` model (after `created_at` line):
```prisma
  updatedAt  DateTime @updatedAt
```

- [ ] **Step 3: Generate migration**

```bash
npx prisma migrate dev --name add-playlist-and-search-updated
```

- [ ] **Step 4: Verify generated client**

```bash
npx prisma generate
```

Check that `app/generated/prisma` has the new types.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Playlist, PlaylistSong models; updatedAt on SearchHistory"
```

---

### Task 2: Update SearchHistory Handlers

**Files:**
- Modify: `app/api/user/search-history/route.ts`

- [ ] **Step 1: Update GET handler sort order**

Change line 14 from:
```ts
orderBy: { created_at: 'desc' },
```
to:
```ts
orderBy: { updatedAt: 'desc' },
```

- [ ] **Step 2: Update POST handler — remove manual created_at**

Change the upsert `update` block (line 32) from:
```ts
update: { created_at: new Date(), title, artist, image_url: image_url ?? null },
```
to:
```ts
update: { title, artist, image_url: image_url ?? null },
```

Prisma's `@updatedAt` will auto-bump `updatedAt` on any update.

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add app/api/user/search-history/route.ts
git commit -m "refactor: SearchHistory uses updatedAt for recency sorting"
```

---

### Task 3: Playlist CRUD API

**Files:**
- Create: `app/api/playlists/route.ts`
- Create: `app/api/playlists/[id]/route.ts`

- [ ] **Step 1: Create GET/POST /api/playlists**

Create `app/api/playlists/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_PLAYLISTS = 50

// GET — list user's playlists with song count
// Auto-creates default "내 찜 목록" if the user has no playlists yet
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  // Auto-create default playlist on first access
  const hasAny = await prisma.playlist.findFirst({ where: { userId: session.user.id }, select: { id: true } })
  if (!hasAny) {
    try {
      await prisma.playlist.create({ data: { userId: session.user.id, name: '내 찜 목록', isDefault: true } })
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== 'P2002') throw e
    }
  }

  const playlists = await prisma.playlist.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    include: { _count: { select: { songs: true } } },
  })

  return Response.json({
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      songCount: p._count.songs,
      coverImage: null, // filled in step 2
      createdAt: p.createdAt,
    })),
    count: playlists.length,
  })
}

// POST — create new playlist
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { name } = await request.json()
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 })

  const count = await prisma.playlist.count({ where: { userId: session.user.id } })
  if (count >= MAX_PLAYLISTS) {
    return Response.json({ error: 'playlist_limit_reached', limitReached: true }, { status: 422 })
  }

  try {
    const playlist = await prisma.playlist.create({
      data: { userId: session.user.id, name: name.trim() },
    })
    return Response.json(playlist, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return Response.json({ error: 'playlist_name_taken' }, { status: 422 })
    }
    throw e
  }
}
```

- [ ] **Step 2: Add cover image to GET response**

Update the GET handler to fetch the first song image for each playlist. Replace `coverImage: null` with a subquery:

```ts
const playlists = await prisma.playlist.findMany({
  where: { userId: session.user.id },
  orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  include: {
    _count: { select: { songs: true } },
    songs: {
      take: 1,
      orderBy: { position: 'asc' },
      include: { song: { select: { image_url: true } } },
    },
  },
})

return Response.json({
  playlists: playlists.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.isDefault,
    songCount: p._count.songs,
    coverImage: p.songs[0]?.song.image_url ?? null,
    createdAt: p.createdAt,
  })),
  count: playlists.length,
})
```

- [ ] **Step 3: Create DELETE /api/playlists/[id]**

Create `app/api/playlists/[id]/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { id } = await params
  const playlist = await prisma.playlist.findUnique({ where: { id } })
  if (!playlist) return Response.json(null, { status: 404 })
  if (playlist.userId !== session.user.id) return Response.json({ error: 'forbidden' }, { status: 403 })
  if (playlist.isDefault) return Response.json({ error: 'default_playlist' }, { status: 403 })

  await prisma.playlist.delete({ where: { id } })
  return Response.json({ ok: true })
}
```

- [ ] **Step 4: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add app/api/playlists/
git commit -m "feat: playlist CRUD API (list, create, delete)"
```

---

### Task 4: Playlist Songs API

**Files:**
- Create: `app/api/playlists/[id]/songs/route.ts`
- Create: `app/api/playlists/[id]/songs/[songId]/route.ts`
- Create: `app/api/playlists/[id]/songs/reorder/route.ts`

- [ ] **Step 1: Create GET/POST playlist songs**

Create `app/api/playlists/[id]/songs/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

async function verifyOwnership(playlistId: string, userId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } })
  if (!playlist) return { error: Response.json(null, { status: 404 }) }
  if (playlist.userId !== userId) return { error: Response.json({ error: 'forbidden' }, { status: 403 }) }
  return { playlist }
}

// GET — songs in playlist ordered by position
export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { id } = await params
  const check = await verifyOwnership(id, session.user.id)
  if ('error' in check) return check.error

  const songs = await prisma.playlistSong.findMany({
    where: { playlistId: id },
    orderBy: { position: 'asc' },
    include: {
      song: {
        select: {
          id: true, genius_id: true, title: true, artist: true,
          image_url: true, album: true,
        },
      },
    },
  })

  return Response.json(songs.map((ps) => ({
    id: ps.id,
    songId: ps.songId,
    position: ps.position,
    addedAt: ps.addedAt,
    ...ps.song,
  })))
}

// Helper: ensure default playlist exists (auto-create on first save)
async function ensureDefaultPlaylist(userId: string) {
  const existing = await prisma.playlist.findFirst({
    where: { userId, isDefault: true },
  })
  if (existing) return existing

  try {
    return await prisma.playlist.create({
      data: { userId, name: '내 찜 목록', isDefault: true },
    })
  } catch (e: unknown) {
    // P2002 = concurrent request already created it
    if ((e as { code?: string }).code === 'P2002') {
      return prisma.playlist.findFirst({ where: { userId, isDefault: true } })
    }
    throw e
  }
}

// POST — add song to playlist (idempotent)
// If playlistId is "default", resolve to the user's default playlist (auto-create if needed)
export async function POST(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  let { id } = await params

  // Support "default" as a special alias
  if (id === 'default') {
    const defaultPlaylist = await ensureDefaultPlaylist(session.user.id)
    if (!defaultPlaylist) return Response.json({ error: 'failed to create default playlist' }, { status: 500 })
    id = defaultPlaylist.id
  }

  const check = await verifyOwnership(id, session.user.id)
  if ('error' in check) return check.error

  const { songId } = await request.json()
  if (!songId) return Response.json({ error: 'songId required' }, { status: 400 })

  // Check if already in playlist
  const existing = await prisma.playlistSong.findUnique({
    where: { playlistId_songId: { playlistId: id, songId } },
  })
  if (existing) return Response.json({ ok: true, alreadyExists: true })

  // Assign position inside transaction to prevent duplicates
  await prisma.$transaction(async (tx) => {
    const count = await tx.playlistSong.count({ where: { playlistId: id } })
    await tx.playlistSong.create({
      data: { playlistId: id, songId, position: count },
    })
  })

  return Response.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 2: Create DELETE playlist song**

Create `app/api/playlists/[id]/songs/[songId]/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string; songId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { id, songId } = await params

  const playlist = await prisma.playlist.findUnique({ where: { id } })
  if (!playlist) return Response.json(null, { status: 404 })
  if (playlist.userId !== session.user.id) return Response.json({ error: 'forbidden' }, { status: 403 })

  const entry = await prisma.playlistSong.findUnique({
    where: { playlistId_songId: { playlistId: id, songId } },
  })
  if (!entry) return Response.json(null, { status: 404 })

  await prisma.playlistSong.delete({ where: { id: entry.id } })
  return Response.json({ ok: true })
}
```

- [ ] **Step 3: Create PUT reorder**

Create `app/api/playlists/[id]/songs/reorder/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { id } = await params

  const playlist = await prisma.playlist.findUnique({ where: { id } })
  if (!playlist) return Response.json(null, { status: 404 })
  if (playlist.userId !== session.user.id) return Response.json({ error: 'forbidden' }, { status: 403 })

  const { order } = await request.json() as { order: string[] }
  if (!Array.isArray(order)) return Response.json({ error: 'order must be an array' }, { status: 400 })

  // Verify all songIds belong to this playlist
  const existing = await prisma.playlistSong.findMany({
    where: { playlistId: id },
    select: { songId: true },
  })
  const existingIds = new Set(existing.map((e) => e.songId))

  if (order.length !== existingIds.size) {
    return Response.json({ error: 'order length must match playlist song count' }, { status: 422 })
  }
  for (const songId of order) {
    if (!existingIds.has(songId)) {
      return Response.json({ error: `songId ${songId} not in playlist` }, { status: 422 })
    }
  }

  // Update all positions in a single transaction
  await prisma.$transaction(
    order.map((songId, i) =>
      prisma.playlistSong.update({
        where: { playlistId_songId: { playlistId: id, songId } },
        data: { position: i },
      })
    )
  )

  return Response.json({ ok: true })
}
```

- [ ] **Step 4: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add app/api/playlists/
git commit -m "feat: playlist songs API (add, remove, reorder)"
```

---

### Task 5: Song ↔ Playlist Lookup API

**Files:**
- Create: `app/api/songs/[id]/playlists/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/songs/[id]/playlists/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

// GET — which of my playlists contain this song?
export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { id } = await params

  // id could be CUID or genius_id — resolve to Song.id
  let songId = id
  const song = await prisma.song.findFirst({
    where: { OR: [{ id }, { genius_id: id }] },
    select: { id: true },
  })
  if (song) songId = song.id

  const entries = await prisma.playlistSong.findMany({
    where: {
      songId,
      playlist: { userId: session.user.id },
    },
    select: { playlistId: true },
  })

  return Response.json({ playlistIds: entries.map((e) => e.playlistId) })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/songs/
git commit -m "feat: song-to-playlist lookup endpoint"
```

---

### Task 6: Search API

**Files:**
- Create: `app/api/search/route.ts`

- [ ] **Step 1: Create unified search route**

Create `app/api/search/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { searchSongs } from '@/lib/genius'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  const type = request.nextUrl.searchParams.get('type') ?? 'songs'

  if (!q || q.length < 2) return Response.json([])

  // Genius search returns song hits — we extract artists/albums from them
  const hits = await searchSongs(q)

  if (type === 'songs') {
    return Response.json(hits)
  }

  if (type === 'artists') {
    // Deduplicate by primary_artist.id — but searchSongs doesn't return this.
    // We need to call Genius raw search to get artist info from hits.
    const { geniusFetchRaw } = await import('@/lib/genius')
    const params = new URLSearchParams({ q, per_page: '20' })
    const data = await geniusFetchRaw(`/search?${params}`)
    const rawHits = data.response.hits.filter((h: { type: string }) => h.type === 'song')

    const seen = new Set<string>()
    const artists: Array<{ id: string; name: string; image_url: string | null }> = []

    for (const hit of rawHits) {
      const a = hit.result.primary_artist
      const aid = String(a.id)
      if (seen.has(aid)) continue
      seen.add(aid)
      artists.push({
        id: aid,
        name: a.name,
        image_url: a.image_url ?? null,
      })
      if (artists.length >= 10) break
    }
    return Response.json(artists)
  }

  if (type === 'albums') {
    const { geniusFetchRaw } = await import('@/lib/genius')
    const params = new URLSearchParams({ q, per_page: '20' })
    const data = await geniusFetchRaw(`/search?${params}`)
    const rawHits = data.response.hits.filter((h: { type: string }) => h.type === 'song')

    const seen = new Set<string>()
    const albums: Array<{ id: string; name: string; cover_art_url: string | null; artist: string }> = []

    for (const hit of rawHits) {
      const song = hit.result
      if (!song.album) continue
      const albumId = String(song.album.id)
      if (seen.has(albumId)) continue
      seen.add(albumId)
      albums.push({
        id: albumId,
        name: song.album.name,
        cover_art_url: song.album.cover_art_url ?? null,
        artist: song.artist_names,
      })
      if (albums.length >= 10) break
    }
    return Response.json(albums)
  }

  return Response.json([])
}
```

- [ ] **Step 2: Export geniusFetchRaw from genius.ts**

Add to `lib/genius.ts` (after the existing `geniusFetch` function):

```ts
// Raw fetch — returns full Genius API response (for search with artist/album data)
export async function geniusFetchRaw(path: string, revalidate = 0) {
  return geniusFetch(path, revalidate)
}
```

Note: `geniusFetch` is currently a private function. Either export it directly renamed as `geniusFetchRaw`, or create a thin wrapper. The simplest approach is to just export the existing function with an alias.

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add app/api/search/ lib/genius.ts
git commit -m "feat: unified search API (songs, artists, albums)"
```

---

### Task 7: Spotify Lib Functions

**Files:**
- Modify: `lib/spotify.ts`

- [ ] **Step 1: Add getSpotifyPlaylists**

Add to `lib/spotify.ts` after `getNowPlaying`:

```ts
export interface SpotifyPlaylist {
  id: string
  name: string
  trackCount: number
  image_url: string | null
}

export async function getSpotifyPlaylists(userId: string): Promise<SpotifyPlaylist[]> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'spotify' },
  })
  if (!account?.access_token) return []

  let token = account.access_token
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 30) {
    if (!account.refresh_token) return []
    const refreshed = await refreshSpotifyToken(account.id, account.refresh_token)
    if (!refreshed) return []
    token = refreshed
  }

  const playlists: SpotifyPlaylist[] = []
  let url: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50'

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) break

    const data = await res.json()
    for (const item of data.items ?? []) {
      playlists.push({
        id: item.id,
        name: item.name,
        trackCount: item.tracks?.total ?? 0,
        image_url: item.images?.[0]?.url ?? null,
      })
    }
    url = data.next
  }

  return playlists
}
```

- [ ] **Step 2: Add getSpotifyPlaylistTracks**

```ts
export interface SpotifyTrack {
  title: string
  artist: string
  spotifyId: string
}

export async function getSpotifyPlaylistTracks(userId: string, playlistId: string): Promise<SpotifyTrack[]> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'spotify' },
  })
  if (!account?.access_token) return []

  let token = account.access_token
  if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 30) {
    if (!account.refresh_token) return []
    const refreshed = await refreshSpotifyToken(account.id, account.refresh_token)
    if (!refreshed) return []
    token = refreshed
  }

  const tracks: SpotifyTrack[] = []
  let url: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,artists)),next`

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) break

    const data = await res.json()
    for (const item of data.items ?? []) {
      const t = item.track
      if (!t?.name) continue
      tracks.push({
        title: t.name,
        artist: t.artists?.map((a: { name: string }) => a.name).join(', ') ?? '',
        spotifyId: t.id,
      })
    }
    url = data.next
  }

  return tracks
}
```

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add lib/spotify.ts
git commit -m "feat: Spotify playlist list and track fetch functions"
```

---

### Task 8: Spotify API Routes

**Files:**
- Create: `app/api/spotify/playlists/route.ts`
- Create: `app/api/playlists/import/spotify/route.ts`

- [ ] **Step 1: Create GET /api/spotify/playlists**

Create `app/api/spotify/playlists/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSpotifyPlaylists } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  // Check if Spotify account is linked
  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'spotify' },
    select: { id: true },
  })
  if (!account) {
    return Response.json({ error: 'spotify_not_linked' }, { status: 403 })
  }

  const playlists = await getSpotifyPlaylists(session.user.id)
  return Response.json(playlists)
}
```

- [ ] **Step 2: Create POST /api/playlists/import/spotify**

Create `app/api/playlists/import/spotify/route.ts`:

```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSpotifyPlaylistTracks } from '@/lib/spotify'
import { searchSongs } from '@/lib/genius'

const MAX_PLAYLISTS = 50
const CONCURRENCY = 5

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { spotifyPlaylistId, name } = await request.json()
  if (!spotifyPlaylistId) {
    return Response.json({ error: 'spotifyPlaylistId required' }, { status: 400 })
  }

  // Check playlist limit
  const count = await prisma.playlist.count({ where: { userId: session.user.id } })
  if (count >= MAX_PLAYLISTS) {
    return Response.json({ error: 'playlist_limit_reached', limitReached: true }, { status: 422 })
  }

  // Fetch all tracks from Spotify
  const tracks = await getSpotifyPlaylistTracks(session.user.id, spotifyPlaylistId)
  if (tracks.length === 0) {
    return Response.json({ error: 'empty_playlist' }, { status: 422 })
  }

  // Determine playlist name
  let playlistName = name?.trim() || 'Spotify Import'
  const existing = await prisma.playlist.findUnique({
    where: { userId_name: { userId: session.user.id, name: playlistName } },
  })
  if (existing) playlistName += ' (가져오기)'

  // Create the playlist
  const playlist = await prisma.playlist.create({
    data: { userId: session.user.id, name: playlistName },
  })

  // Search Genius for each track with concurrency limit
  let imported = 0
  let skipped = 0

  async function processTrack(track: { title: string; artist: string }, position: number) {
    try {
      const results = await searchSongs(`${track.title} ${track.artist}`)
      if (results.length === 0) { skipped++; return }

      const hit = results[0]
      // Upsert the song
      const song = await prisma.song.upsert({
        where: { genius_id: hit.genius_id },
        create: {
          genius_id: hit.genius_id,
          title: hit.title,
          artist: hit.artist,
          image_url: hit.image_url,
          genius_path: hit.genius_path,
        },
        update: {},
      })

      // Add to playlist
      await prisma.playlistSong.create({
        data: { playlistId: playlist.id, songId: song.id, position },
      }).catch(() => {}) // ignore duplicate

      imported++
    } catch {
      skipped++
    }
  }

  // Process in batches of CONCURRENCY
  for (let i = 0; i < tracks.length; i += CONCURRENCY) {
    const batch = tracks.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map((track, j) => processTrack(track, i + j)))
  }

  return Response.json({
    playlistId: playlist.id,
    imported,
    skipped,
    total: tracks.length,
  })
}
```

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add app/api/spotify/playlists/ app/api/playlists/import/
git commit -m "feat: Spotify playlist list and import API"
```

---

### Task 9: UserDropdown Component + Layout Changes

**Files:**
- Create: `components/nav/UserDropdown.tsx`
- Modify: `app/(main)/layout.tsx`

- [ ] **Step 1: Create UserDropdown component**

Create `components/nav/UserDropdown.tsx`:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface Props {
  user: { image?: string | null; name?: string | null }
}

const menuItems = [
  { label: 'Recents', href: '/recents' },
  { label: '플레이리스트', href: '/playlists' },
  { label: '설정', href: '/profile' },
]

export function UserDropdown({ user }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {user.image ? (
          <img
            src={user.image}
            alt=""
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1px solid var(--border-strong)',
            }}
          />
        ) : (
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-strong)',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--r-lg)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            minWidth: '180px',
            padding: '6px 0',
            zIndex: 60,
          }}
        >
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '10px 16px',
                fontSize: 'var(--text-sm)',
                color: 'var(--text)',
                textDecoration: 'none',
                transition: 'background var(--dur)',
              }}
              className="hover-row"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update layout.tsx**

In `app/(main)/layout.tsx`, add import at top:

```ts
import { UserDropdown } from '@/components/nav/UserDropdown'
```

Replace the avatar `<Link>` block (lines 56-69):

```tsx
{session ? (
  <Link href="/profile" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
    {session.user?.image && (
      <img ... />
    )}
  </Link>
) : (
```

With:

```tsx
{session ? (
  <UserDropdown user={{ image: session.user?.image, name: session.user?.name }} />
) : (
```

Also add a "검색" link in the nav. Before the `{session ?` block, add:

```tsx
<Link
  href="/search"
  style={{
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: 'var(--text-sm)',
  }}
  className="hover-dim"
>
  검색
</Link>
```

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add components/nav/ app/\(main\)/layout.tsx
git commit -m "feat: nav dropdown menu and search link"
```

---

### Task 10: Search Page

**Files:**
- Create: `app/(main)/search/page.tsx`

- [ ] **Step 1: Create search page**

Create `app/(main)/search/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type SearchType = 'songs' | 'artists' | 'albums'

const TABS: { key: SearchType; label: string }[] = [
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
]

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [type, setType] = useState<SearchType>((searchParams.get('type') as SearchType) ?? 'songs')
  const [results, setResults] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async (q: string, t: SearchType) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${t}`)
      if (res.ok) setResults(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        router.replace(`/search?q=${encodeURIComponent(query)}&type=${type}`, { scroll: false })
        doSearch(query, type)
      } else {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, type, doSearch, router])

  // Initial load from URL params
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.length >= 2) doSearch(q, type)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      <h1 style={{
        margin: '32px 0 24px',
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 'var(--text-2xl)',
        fontWeight: 400,
        color: 'var(--text)',
      }}>
        검색
      </h1>

      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="노래, 아티스트, 앨범 검색..."
        style={{
          width: '100%',
          padding: '12px 16px',
          fontSize: 'var(--text-base)',
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          color: 'var(--text)',
          outline: 'none',
          marginBottom: '20px',
        }}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setType(tab.key)}
            style={{
              padding: '8px 18px',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all var(--dur)',
              background: type === tab.key ? 'var(--accent)' : 'var(--bg-subtle)',
              color: type === tab.key ? '#000' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading && <div className="spinner" style={{ margin: '40px auto' }} />}

      {!loading && results.length === 0 && query.length >= 2 && (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '40px 0' }}>
          검색 결과가 없어요
        </p>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {type === 'songs' && (results as Array<{ genius_id: string; title: string; artist: string; image_url: string | null }>).map((s) => (
            <Link
              key={s.genius_id}
              href={`/songs/${s.genius_id}`}
              className="hover-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '10px 12px', borderRadius: 'var(--r-md)',
                textDecoration: 'none', transition: 'background var(--dur)',
              }}
            >
              {s.image_url && (
                <img src={s.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.artist}</p>
              </div>
            </Link>
          ))}

          {type === 'artists' && (results as Array<{ id: string; name: string; image_url: string | null }>).map((a) => (
            <Link
              key={a.id}
              href={`/artists/${a.id}`}
              className="hover-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '10px 12px', borderRadius: 'var(--r-md)',
                textDecoration: 'none', transition: 'background var(--dur)',
              }}
            >
              {a.image_url && (
                <img src={a.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)' }}>{a.name}</p>
            </Link>
          ))}

          {type === 'albums' && (results as Array<{ id: string; name: string; cover_art_url: string | null; artist: string }>).map((al) => (
            <Link
              key={al.id}
              href={`/albums/${al.id}`}
              className="hover-row"
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '10px 12px', borderRadius: 'var(--r-md)',
                textDecoration: 'none', transition: 'background var(--dur)',
              }}
            >
              {al.cover_art_url && (
                <img src={al.cover_art_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{al.name}</p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{al.artist}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add app/\(main\)/search/
git commit -m "feat: search page with songs/artists/albums tabs"
```

---

### Task 11: Recents Page

**Files:**
- Create: `app/(main)/recents/page.tsx`

- [ ] **Step 1: Create recents page**

Create `app/(main)/recents/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function formatDateGroup(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diff = today.getTime() - d.getTime()
  if (diff === 0) return '오늘'
  if (diff === 86400000) return '어제'

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function RecentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const history = await prisma.searchHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  })

  // Group by date
  const groups: Map<string, typeof history> = new Map()
  for (const entry of history) {
    const label = formatDateGroup(entry.updatedAt)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(entry)
  }

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      <h1 style={{
        margin: '32px 0 28px',
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 'var(--text-2xl)',
        fontWeight: 400,
        color: 'var(--text)',
      }}>
        Recents
      </h1>

      {history.length === 0 && (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '60px 0' }}>
          아직 검색 기록이 없어요
        </p>
      )}

      {Array.from(groups.entries()).map(([label, entries]) => (
        <section key={label} style={{ marginBottom: '28px' }}>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}>
            {label}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/songs/${entry.genius_id}`}
                className="hover-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '10px 12px', borderRadius: 'var(--r-md)',
                  textDecoration: 'none', transition: 'background var(--dur)',
                }}
              >
                {entry.image_url && (
                  <img src={entry.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.artist}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(main\)/recents/
git commit -m "feat: recents page with date-grouped search history"
```

---

### Task 12: Playlists Page

**Files:**
- Create: `app/(main)/playlists/page.tsx`
- Create: `components/playlist/SpotifyImportModal.tsx` (stub — full implementation in Task 15)

- [ ] **Step 0: Create SpotifyImportModal stub (needed for import in PlaylistActions)**

Create `components/playlist/SpotifyImportModal.tsx` as a minimal placeholder:

```tsx
'use client'

export function SpotifyImportModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--r-xl)' }}>
        <p style={{ color: 'var(--text)' }}>Loading...</p>
        <button onClick={onClose} style={{ marginTop: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>닫기</button>
      </div>
    </div>
  )
}
```

This will be replaced with the full implementation in Task 15.

- [ ] **Step 1: Create playlists page**

Create `app/(main)/playlists/page.tsx`. This is a server component that fetches playlists and renders a grid. The "새 플레이리스트", "Spotify에서 가져오기" buttons and the `SpotifyImportModal` need interactivity, so wrap those parts in client components.

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlaylistActions } from './PlaylistActions'

export const dynamic = 'force-dynamic'

export default async function PlaylistsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const playlists = await prisma.playlist.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { songs: true } },
      songs: {
        take: 1,
        orderBy: { position: 'asc' },
        include: { song: { select: { image_url: true } } },
      },
    },
  })

  const hasSpotify = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'spotify' },
    select: { id: true },
  })

  const data = playlists.map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: p.isDefault,
    songCount: p._count.songs,
    coverImage: p.songs[0]?.song.image_url ?? null,
  }))

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      <h1 style={{
        margin: '32px 0 28px',
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 'var(--text-2xl)',
        fontWeight: 400,
        color: 'var(--text)',
      }}>
        플레이리스트
      </h1>

      <PlaylistActions
        count={playlists.length}
        hasSpotify={!!hasSpotify}
      />

      {data.length === 0 && (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '60px 0' }}>
          찜한 곡이 없어요 — 노래 페이지에서 저장해보세요
        </p>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: '16px',
        marginTop: '20px',
      }}>
        {data.map((p) => (
          <Link
            key={p.id}
            href={`/playlists/${p.id}`}
            className="hover-scale"
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--r-lg)',
              padding: '14px',
              textDecoration: 'none',
              transition: 'transform var(--dur)',
            }}
          >
            <div style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
              background: 'var(--bg-subtle)',
              marginBottom: '12px',
            }}>
              {p.coverImage && (
                <img src={p.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
              {p.songCount}곡
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create PlaylistActions client component**

Create `app/(main)/playlists/PlaylistActions.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SpotifyImportModal } from '@/components/playlist/SpotifyImportModal'

const MAX_PLAYLISTS = 50

export function PlaylistActions({ count, hasSpotify }: { count: number; hasSpotify: boolean }) {
  const router = useRouter()
  const [showInput, setShowInput] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const atLimit = count >= MAX_PLAYLISTS

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setError('')
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setCreating(false)
    if (res.ok) {
      setShowInput(false)
      setName('')
      router.refresh()
    } else {
      const data = await res.json()
      if (data.error === 'playlist_name_taken') setError('이미 같은 이름이 있어요')
      else if (data.limitReached) setError('최대 50개까지 만들 수 있어요')
    }
  }

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
      {!showInput ? (
        <button
          onClick={() => !atLimit && setShowInput(true)}
          disabled={atLimit}
          style={{
            padding: '8px 18px',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            borderRadius: '20px',
            border: 'none',
            cursor: atLimit ? 'not-allowed' : 'pointer',
            background: atLimit ? 'var(--bg-subtle)' : 'var(--accent)',
            color: atLimit ? 'var(--text-faint)' : '#000',
            opacity: atLimit ? 0.6 : 1,
          }}
        >
          새 플레이리스트
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="이름 입력"
            autoFocus
            style={{
              padding: '8px 14px',
              fontSize: 'var(--text-sm)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: '8px 14px',
              fontSize: 'var(--text-sm)',
              borderRadius: 'var(--r-md)',
              border: 'none',
              cursor: 'pointer',
              background: 'var(--accent)',
              color: '#000',
              fontWeight: 500,
            }}
          >
            {creating ? '...' : '만들기'}
          </button>
          <button
            onClick={() => { setShowInput(false); setName(''); setError('') }}
            style={{
              padding: '8px',
              fontSize: 'var(--text-sm)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-faint)',
            }}
          >
            취소
          </button>
        </div>
      )}

      {atLimit && !showInput && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
          최대 50개까지 만들 수 있어요
        </span>
      )}

      {error && (
        <span style={{ fontSize: 'var(--text-xs)', color: '#e55' }}>{error}</span>
      )}

      {hasSpotify && (
        <button
          onClick={() => !atLimit && setShowImport(true)}
          disabled={atLimit}
          style={{
            padding: '8px 18px',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            borderRadius: '20px',
            border: '1px solid var(--border)',
            cursor: atLimit ? 'not-allowed' : 'pointer',
            background: 'transparent',
            color: 'var(--text-muted)',
            opacity: atLimit ? 0.5 : 1,
          }}
        >
          Spotify에서 가져오기
        </button>
      )}

      {showImport && <SpotifyImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -5
```

Note: This will fail until `SpotifyImportModal` is created (Task 15). Proceed to next task; build check deferred to Task 15.

- [ ] **Step 4: Commit**

```bash
git add app/\(main\)/playlists/
git commit -m "feat: playlists page with grid cards and create action"
```

---

### Task 13: Playlist Detail Page

**Files:**
- Create: `app/(main)/playlists/[id]/page.tsx`

- [ ] **Step 1: Create playlist detail page**

Create `app/(main)/playlists/[id]/page.tsx`. Server component wraps a client `SongList` for drag-and-drop.

```tsx
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlaylistSongList } from './PlaylistSongList'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function PlaylistDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const { id } = await params
  const playlist = await prisma.playlist.findUnique({
    where: { id },
    include: {
      songs: {
        orderBy: { position: 'asc' },
        include: {
          song: {
            select: { id: true, genius_id: true, title: true, artist: true, image_url: true },
          },
        },
      },
    },
  })

  if (!playlist || playlist.userId !== session.user.id) notFound()

  const songs = playlist.songs.map((ps) => ({
    playlistSongId: ps.id,
    songId: ps.song.id,
    geniusId: ps.song.genius_id,
    title: ps.song.title,
    artist: ps.song.artist,
    imageUrl: ps.song.image_url,
    addedAt: ps.addedAt.toISOString(),
  }))

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '32px 0 28px' }}>
        <h1 style={{
          margin: 0,
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 'var(--text-2xl)',
          fontWeight: 400,
          color: 'var(--text)',
        }}>
          {playlist.name}
        </h1>
        {!playlist.isDefault && (
          <DeletePlaylistButton playlistId={playlist.id} />
        )}
      </div>

      {songs.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '60px 0' }}>
          아직 저장된 곡이 없어요
        </p>
      ) : (
        <PlaylistSongList playlistId={playlist.id} initialSongs={songs} />
      )}
    </div>
  )
}

// Small client component for delete
function DeletePlaylistButton({ playlistId }: { playlistId: string }) {
  'use client' // Note: This won't work as a nested function declaration.
  // Move to separate file or inline as client component.
  return null // Placeholder — implemented in Step 2
}
```

**Note:** `DeletePlaylistButton` must be a separate `'use client'` component. Create it inline in the same folder.

- [ ] **Step 2: Create client components for playlist detail**

Create `app/(main)/playlists/[id]/PlaylistSongList.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Song {
  playlistSongId: string
  songId: string
  geniusId: string
  title: string
  artist: string
  imageUrl: string | null
  addedAt: string
}

export function PlaylistSongList({ playlistId, initialSongs }: { playlistId: string; initialSongs: Song[] }) {
  const [songs, setSongs] = useState(initialSongs)
  const [dragging, setDragging] = useState<number | null>(null)
  const router = useRouter()

  async function handleRemove(songId: string) {
    setSongs((prev) => prev.filter((s) => s.songId !== songId))
    const res = await fetch(`/api/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE' })
    if (!res.ok) {
      setSongs(initialSongs) // revert
    }
  }

  function handleDragStart(idx: number) {
    setDragging(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragging === null || dragging === idx) return
    const updated = [...songs]
    const [moved] = updated.splice(dragging, 1)
    updated.splice(idx, 0, moved)
    setSongs(updated)
    setDragging(idx)
  }

  async function handleDragEnd() {
    setDragging(null)
    // Save new order
    const order = songs.map((s) => s.songId)
    const res = await fetch(`/api/playlists/${playlistId}/songs/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    })
    if (!res.ok) {
      setSongs(initialSongs) // revert on failure
    } else {
      router.refresh()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {songs.map((song, idx) => (
        <div
          key={song.playlistSongId}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragEnd={handleDragEnd}
          className="hover-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '10px 12px',
            borderRadius: 'var(--r-md)',
            transition: 'background var(--dur)',
            opacity: dragging === idx ? 0.5 : 1,
          }}
        >
          {/* Drag handle */}
          <span style={{ cursor: 'grab', color: 'var(--text-faint)', fontSize: 'var(--text-sm)', flexShrink: 0, width: '16px', textAlign: 'center' }}>
            ⠿
          </span>

          <Link
            href={`/songs/${song.geniusId}`}
            style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, textDecoration: 'none' }}
          >
            {song.imageUrl && (
              <img src={song.imageUrl} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {song.title}
              </p>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {song.artist}
              </p>
            </div>
          </Link>

          <button
            onClick={() => handleRemove(song.songId)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-faint)',
              fontSize: 'var(--text-xs)',
              padding: '6px 10px',
              borderRadius: 'var(--r-sm)',
              flexShrink: 0,
            }}
            className="hover-row"
          >
            제거
          </button>
        </div>
      ))}
    </div>
  )
}
```

Create `app/(main)/playlists/[id]/DeletePlaylistButton.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'

export function DeletePlaylistButton({ playlistId }: { playlistId: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('플레이리스트를 삭제할까요?')) return
    const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' })
    if (res.ok) router.replace('/playlists')
  }

  return (
    <button
      onClick={handleDelete}
      style={{
        padding: '6px 14px',
        fontSize: 'var(--text-xs)',
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        color: 'var(--text-faint)',
        cursor: 'pointer',
      }}
      className="hover-row"
    >
      삭제
    </button>
  )
}
```

Update `app/(main)/playlists/[id]/page.tsx`: replace the `DeletePlaylistButton` placeholder with an import:

```tsx
import { DeletePlaylistButton } from './DeletePlaylistButton'
```

Remove the placeholder function definition at the bottom.

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | tail -5
```

Note: May fail if `SpotifyImportModal` not yet created. Proceed.

- [ ] **Step 4: Commit**

```bash
git add app/\(main\)/playlists/
git commit -m "feat: playlist detail page with drag-and-drop reorder"
```

---

### Task 14: Favorite Button & Modal

**Files:**
- Create: `components/playlist/FavoriteButton.tsx`
- Create: `components/playlist/FavoriteModal.tsx`
- Modify: `app/(main)/songs/[id]/page.tsx`

- [ ] **Step 1: Create FavoriteModal**

Create `components/playlist/FavoriteModal.tsx`:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'

const MAX_PLAYLISTS = 50

interface Playlist {
  id: string
  name: string
  songCount: number
  isDefault: boolean
}

interface Props {
  songId: string
  savedPlaylistIds: string[]
  onClose: () => void
  onUpdate: (ids: string[]) => void
}

export function FavoriteModal({ songId, savedPlaylistIds, onClose, onUpdate }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(savedPlaylistIds))
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/playlists')
      .then((r) => r.json())
      .then((data) => {
        setPlaylists(data.playlists ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  async function handleToggle(playlistId: string) {
    const isChecked = checkedIds.has(playlistId)
    const next = new Set(checkedIds)

    if (isChecked) {
      next.delete(playlistId)
      setCheckedIds(next)
      onUpdate(Array.from(next))
      const res = await fetch(`/api/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE' })
      if (!res.ok) {
        next.add(playlistId)
        setCheckedIds(new Set(next))
        onUpdate(Array.from(next))
      }
    } else {
      next.add(playlistId)
      setCheckedIds(next)
      onUpdate(Array.from(next))
      await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId }),
      })
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreateError('')
    const res = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const created = await res.json()
      setPlaylists((prev) => [...prev, { id: created.id, name: created.name, songCount: 0, isDefault: false }])
      setShowCreate(false)
      setNewName('')
      // Auto-add the song to the new playlist
      handleToggle(created.id)
    } else {
      const data = await res.json()
      if (data.error === 'playlist_name_taken') setCreateError('이미 같은 이름이 있어요')
      else if (data.limitReached) setCreateError('최대 50개까지 만들 수 있어요')
    }
  }

  const atLimit = playlists.length >= MAX_PLAYLISTS

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div ref={ref} style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r-xl)',
        padding: '24px',
        minWidth: '320px',
        maxWidth: '400px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{
          margin: '0 0 16px', fontSize: 'var(--text-md)',
          fontWeight: 600, color: 'var(--text)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          저장할 목록 선택
        </h3>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: '36px', borderRadius: 'var(--r-md)' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {playlists.map((p) => (
              <label
                key={p.id}
                className="hover-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: 'var(--r-md)',
                  cursor: 'pointer', fontSize: 'var(--text-sm)',
                  color: 'var(--text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(p.id)}
                  onChange={() => handleToggle(p.id)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span style={{ flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                  {p.songCount}곡
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Create new */}
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          {!showCreate ? (
            <button
              onClick={() => !atLimit && setShowCreate(true)}
              disabled={atLimit}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: 'var(--text-sm)',
                background: 'none',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--r-md)',
                cursor: atLimit ? 'not-allowed' : 'pointer',
                color: atLimit ? 'var(--text-faint)' : 'var(--text-muted)',
                opacity: atLimit ? 0.5 : 1,
              }}
            >
              + 새 플레이리스트
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="이름 입력"
                autoFocus
                style={{
                  flex: 1, padding: '8px 10px', fontSize: 'var(--text-sm)',
                  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', color: 'var(--text)', outline: 'none',
                }}
              />
              <button
                onClick={handleCreate}
                style={{
                  padding: '8px 12px', fontSize: 'var(--text-sm)',
                  background: 'var(--accent)', color: '#000', border: 'none',
                  borderRadius: 'var(--r-md)', cursor: 'pointer', fontWeight: 500,
                }}
              >
                확인
              </button>
            </div>
          )}
          {atLimit && !showCreate && (
            <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
              최대 50개까지 만들 수 있어요
            </p>
          )}
          {createError && (
            <p style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: '#e55' }}>{createError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create FavoriteButton**

Create `components/playlist/FavoriteButton.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { FavoriteModal } from './FavoriteModal'

export function FavoriteButton({ songId }: { songId: string }) {
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetch(`/api/songs/${songId}/playlists`)
      .then((r) => {
        if (r.status === 401) { setHidden(true); return null }
        return r.json()
      })
      .then((data) => {
        if (data) setSavedIds(data.playlistIds ?? [])
        setLoading(false)
      })
  }, [songId])

  if (hidden) return null

  const isSaved = savedIds.length > 0

  return (
    <>
      <button
        onClick={() => !loading && setShowModal(true)}
        disabled={loading}
        style={{
          background: 'none',
          border: 'none',
          cursor: loading ? 'default' : 'pointer',
          padding: '4px',
          fontSize: '22px',
          lineHeight: 1,
          color: isSaved ? 'var(--accent)' : 'var(--text-faint)',
          opacity: loading ? 0.3 : 1,
          transition: 'color var(--dur), opacity var(--dur)',
        }}
        title={isSaved ? '저장됨' : '저장'}
      >
        {isSaved ? '♥' : '♡'}
      </button>

      {showModal && (
        <FavoriteModal
          songId={songId}
          savedPlaylistIds={savedIds}
          onClose={() => setShowModal(false)}
          onUpdate={(ids) => setSavedIds(ids)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Add FavoriteButton to song detail page**

In `app/(main)/songs/[id]/page.tsx`, add import:

```ts
import { FavoriteButton } from '@/components/playlist/FavoriteButton'
```

Find the song title `<h1>` in the page and wrap it alongside the `FavoriteButton`. The exact placement depends on the current layout — look for the song title area and add the button next to it. Place it in a flex row:

Find the section that displays the song title (should be an `<h1>` containing `{song.title}`) and wrap it:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
  <h1 style={{ /* existing styles */ }}>{song.title}</h1>
  <FavoriteButton songId={song.id} />
</div>
```

- [ ] **Step 4: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add components/playlist/ app/\(main\)/songs/
git commit -m "feat: favorite button with playlist modal on song detail"
```

---

### Task 15: Spotify Import Modal

**Files:**
- Create: `components/playlist/SpotifyImportModal.tsx`

- [ ] **Step 1: Create SpotifyImportModal**

Create `components/playlist/SpotifyImportModal.tsx`:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SpotifyPlaylist {
  id: string
  name: string
  trackCount: number
  image_url: string | null
}

export function SpotifyImportModal({ onClose }: { onClose: () => void }) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SpotifyPlaylist | null>(null)
  const [name, setName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/spotify/playlists')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPlaylists(data)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  async function handleImport() {
    if (!selected) return
    setImporting(true)
    setError('')
    const res = await fetch('/api/playlists/import/spotify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spotifyPlaylistId: selected.id,
        name: name.trim() || selected.name,
      }),
    })
    setImporting(false)

    if (res.ok) {
      const data = await res.json()
      setResult({ imported: data.imported, skipped: data.skipped })
      setTimeout(() => {
        router.push(`/playlists/${data.playlistId}`)
        onClose()
      }, 1500)
    } else {
      const data = await res.json()
      if (data.limitReached) setError('최대 50개까지 만들 수 있어요')
      else setError('가져오기 실패')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }}>
      <div ref={ref} style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--r-xl)',
        padding: '24px',
        minWidth: '340px',
        maxWidth: '440px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{
          margin: '0 0 16px', fontSize: 'var(--text-md)',
          fontWeight: 600, color: 'var(--text)',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}>
          Spotify에서 가져오기
        </h3>

        {loading ? (
          <div className="spinner" style={{ margin: '32px auto' }} />
        ) : result ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--accent)', fontSize: 'var(--text-md)', fontWeight: 500 }}>
              가져오기 완료
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: '8px 0 0' }}>
              {result.imported}곡 저장 · {result.skipped}곡 건너뜀
            </p>
          </div>
        ) : !selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setName(p.name) }}
                className="hover-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: 'var(--r-md)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                }}
              >
                {p.image_url && (
                  <img src={p.image_url} alt="" style={{ width: '40px', height: '40px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
                    {p.trackCount}곡
                  </p>
                </div>
              </button>
            ))}
            {playlists.length === 0 && (
              <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '20px 0' }}>
                Spotify 플레이리스트가 없어요
              </p>
            )}
          </div>
        ) : (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              <strong>{selected.name}</strong> ({selected.trackCount}곡)
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="플레이리스트 이름"
              style={{
                width: '100%', padding: '10px 14px', fontSize: 'var(--text-sm)',
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', color: 'var(--text)', outline: 'none',
                marginBottom: '12px',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setSelected(null)}
                style={{
                  flex: 1, padding: '10px', fontSize: 'var(--text-sm)',
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                뒤로
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  flex: 1, padding: '10px', fontSize: 'var(--text-sm)',
                  background: 'var(--accent)', border: 'none',
                  borderRadius: 'var(--r-md)', color: '#000',
                  cursor: importing ? 'wait' : 'pointer', fontWeight: 500,
                }}
              >
                {importing ? '가져오는 중...' : '가져오기'}
              </button>
            </div>
            {error && (
              <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: '#e55' }}>{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Full build check**

```bash
npx next build 2>&1 | tail -10
```

All components and routes should now resolve.

- [ ] **Step 3: Commit**

```bash
git add components/playlist/SpotifyImportModal.tsx
git commit -m "feat: Spotify import modal component"
```

---

### Task 16: Update Swagger Docs

**Files:**
- Modify: `app/api/docs/route.ts`

- [ ] **Step 1: Add new endpoints to Swagger spec**

Open `app/api/docs/route.ts` and add the following endpoint definitions to the `paths` object in the OpenAPI spec:

- `GET /api/search` (query, type params; songs/artists/albums response schemas)
- `GET /api/playlists` (authenticated; returns playlist array with song count)
- `POST /api/playlists` (name body; 201/422 responses)
- `DELETE /api/playlists/{id}` (403/404 responses)
- `GET /api/playlists/{id}/songs` (authenticated; song array)
- `POST /api/playlists/{id}/songs` (songId body; idempotent)
- `DELETE /api/playlists/{id}/songs/{songId}`
- `PUT /api/playlists/{id}/songs/reorder` (order body; 422)
- `GET /api/songs/{id}/playlists` (playlistIds response)
- `GET /api/spotify/playlists` (Spotify playlist array)
- `POST /api/playlists/import/spotify` (spotifyPlaylistId + name body)

Also add `Playlist`, `PlaylistSong` schemas to the `components.schemas` section.

- [ ] **Step 2: Build check**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add app/api/docs/route.ts
git commit -m "docs: add playlist/search/import endpoints to Swagger spec"
```

---

### Task 17: Final Integration Check

- [ ] **Step 1: Full build**

```bash
npx next build
```

Verify zero errors.

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Test in browser:
1. Go to `/search` — type a query, switch tabs
2. Click avatar → dropdown appears (Recents / 플레이리스트 / 설정)
3. Go to `/recents` — see date-grouped history
4. Go to `/playlists` — see empty state or "내 찜 목록"
5. Go to a song page → heart button → modal → check a playlist
6. Go back to `/playlists` → see the song in the playlist
7. Open playlist → drag to reorder → verify order persists
8. Try Spotify import (if Spotify account linked)

- [ ] **Step 3: Final commit (squash if needed)**

```bash
git log --oneline -15
```

If all tasks committed individually, no squash needed. Verify all changes are committed.
