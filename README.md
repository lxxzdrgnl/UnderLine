# under-line

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Genius](https://img.shields.io/badge/Genius-API-FFFF64?style=flat-square&logoColor=black)
![Spotify](https://img.shields.io/badge/Spotify-API-1DB954?style=flat-square&logo=spotify&logoColor=white)

---

## Screenshots

| Home | Lyrics |
|:---:|:---:|
| ![Home](public/screenshot/home.png) | ![Lyrics](public/screenshot/lyrics.png) |

| Recents | Spotify Import |
|:---:|:---:|
| ![Recents](public/screenshot/recents.png) | ![Import](public/screenshot/import.png) |

---

## Production

- **App**: https://underline.rheon.kr
- **API Docs**: https://underline.rheon.kr/docs
- **Health**: https://underline.rheon.kr/api/system/health

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (running — Docker recommended)
- API keys: Genius, OpenAI, Google OAuth, Spotify OAuth

### Setup

```bash
git clone https://github.com/yourname/under-line
cd under-line
npm install
```

Copy `.env` and fill in values:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/underline"
AUTH_SECRET=""                  # openssl rand -base64 32
AUTH_URL="http://localhost:3000"

AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

SPOTIFY_CLIENT_ID=""
SPOTIFY_CLIENT_SECRET=""

GENIUS_ACCESS_TOKEN=""
OPENAI_API_KEY=""
```

OAuth redirect URIs to register:
- Google: `http://localhost:3000/api/auth/callback/google`
- Spotify: `http://localhost:3000/api/oauth/spotify/callback`

```bash
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000`.

---

## Environment Variables

| Variable | Required | Where to get it |
|---|---|---|
| `DATABASE_URL` | Yes | Local: `docker compose up -d`, then `postgresql://postgres:postgres@localhost:5432/underline` |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `AUTH_URL` | Yes | Base URL of the app (`http://localhost:3000` for local dev) |
| `AUTH_GOOGLE_ID` | Yes | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client |
| `AUTH_GOOGLE_SECRET` | Yes | Same as above |
| `SPOTIFY_CLIENT_ID` | Yes | [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → Create App |
| `SPOTIFY_CLIENT_SECRET` | Yes | Same as above |
| `GENIUS_ACCESS_TOKEN` | Yes | [Genius API Clients](https://genius.com/api-clients) → Generate access token |
| `OPENAI_API_KEY` | Yes | [OpenAI API Keys](https://platform.openai.com/api-keys) |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error` (default: `info`) |

**Spotify app settings** (in Developer Dashboard):
- Redirect URI: `http://localhost:3000/api/oauth/spotify/callback`
- Required scopes: `user-read-currently-playing`, `user-read-playback-state`, `user-read-email`, `playlist-read-private`, `playlist-read-collaborative`

---

## Features

### Core
- **Line-by-line interpretation** — every lyric translated to Korean with slang decoding, cultural references, and hidden meanings
- **Streaming UX** — results appear line by line via NDJSON; instant load on repeat visits
- **Auto-translate descriptions** — English song descriptions auto-translated to Korean via GPT-4o-mini, cached in DB (`description_ko`)
- **Lazy detail loading** — songs store basic info on first encounter; full metadata (album, description, streaming links, featured artists) fetched from Genius on first page visit

### Library
- **Playlists** — create up to 50 playlists, add/remove songs, drag-and-drop reorder
- **Playlist covers** — auto-generated 2x2 mosaic from first 4 songs, gradient fallback for empty lists
- **Favorite button** — save songs to playlists from any song page (heart icon → bottom sheet on mobile, centered modal on desktop)
- **Spotify import** — browse your Spotify playlists, select one, choose a name, import matching songs via Genius search. Title similarity check prevents irrelevant matches. Only user-owned playlists supported (Spotify 2026 Feb API restriction)
- **Recents** — date-grouped search history (오늘/어제/날짜) with search filter, cursor-based infinite scroll, per-item delete
- **Delete playlists** — custom confirmation modal (no browser `confirm()`), available on card hover and detail page

### Search
- **Home search** — debounced search with unified dropdown (recent history + search results), infinite scroll in dropdown, clear button
- **Search page** — tabbed search (노래/아티스트/앨범) with page-based infinite scroll via IntersectionObserver
- **Translation filter** — Genius translation pages (`-translation` path suffix) and Genius translation artists auto-excluded; fetches 3x results to compensate for filtered entries
- **Genius match validation** — Spotify import validates title similarity to prevent playlist names or unrelated content from being imported as songs

### Discovery
- **Artist pages** — hero with background breakout, photo, bio, top songs
- **Album pages** — cover art, full track list in card layout with equalizer animation on current track
- **Featured artists** — separated from main artist, linked to artist pages, `feat.` inline display
- **Artist name cleanup** — removes Genius tags like `(KOR)`, `(Ft. ...)` from display; handles nested parentheses

### Integration
- **Spotify NowPlaying** — currently playing track on home page with progress bar, click to view lyrics
- **Spotify account management** — link/unlink from profile with Google & Spotify SVG icons
- **OAuth login** — Google and Spotify; custom PKCE flow for account linking
- **Genius Romanizations** — Japanese songs auto-resolved to native script via `song_relationships`

### UI/UX
- **Spotify-inspired design** — dark theme (#121212), green accent (#1DB954), Playfair Display (logo) + IBM Plex Sans (body) typography
- **Responsive** — mobile-first with adaptive padding (16px mobile / 28px desktop), profile hero stacks vertically on mobile
- **Bottom sheets** — favorite modal, interpretation panel use slide-up bottom sheets on mobile
- **Custom modals** — playlist create, delete, Spotify import, nickname edit — all use portal-based modals with blur backdrop
- **Profile** — large avatar hero, stats bar (playlists/searches/songs), edit nickname (20 char limit with live counter), linked accounts
- **Navigation** — icon-based nav (search magnifier, user avatar), dropdown with SVG icons and user name
- **Staggered animations** — playlist cards, search results, dropdown items enter with fade-up delays
- **Admin panel** — paginated song list, per-song delete, lyrics status reset (ROLE_ADMIN only)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Node Runtime) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + CSS custom properties (inline styles) |
| Database | PostgreSQL 16 + Prisma 7 ORM |
| Auth | NextAuth.js v5 (Google + Spotify OAuth) |
| AI | OpenAI GPT-4o (lyrics) + GPT-4o-mini (translation) |
| Lyrics source | Genius API + HTML scraping (Cheerio) |
| Music | Spotify Web API (2026 Feb migration) |
| API docs | Swagger UI (`/docs`) |
| Testing | Vitest + jsdom |
| Deployment | Docker Compose + Nginx |

---

## Architecture

```
Browser
  │
  ├── fetch / NDJSON stream
  │
Next.js App Router (Node Runtime)
  ├── middleware.ts            IP-based rate limiting (sliding window)
  │
  ├── app/(main)/              UI pages (server + client components)
  │   ├── page.tsx             Home — search bar + NowPlaying
  │   ├── songs/[id]/          Song detail — header, lyrics, YouTube, album tracks
  │   ├── artists/[id]/        Artist — photo, bio, top songs
  │   ├── albums/[id]/         Album — cover, track list
  │   ├── search/              Tabbed search (songs/artists/albums)
  │   ├── playlists/           Playlist grid + detail with drag reorder
  │   ├── recents/             Date-grouped search history
  │   ├── profile/             Stats, linked accounts, edit name
  │   ├── login/               OAuth login buttons
  │   └── docs/                Swagger UI
  │
  └── app/api/
        ├── auth/              NextAuth (Google + Spotify)
        ├── oauth/[provider]/  Custom PKCE OAuth flow
        ├── songs/             Search, upsert, lyrics stream, translate-description
        ├── search/            Unified search (songs/artists/albums via Genius)
        ├── playlists/         CRUD, song management, reorder, Spotify import
        ├── spotify/           Now playing, playlist list
        ├── user/              Search history, accounts, profile
        ├── system/            Health check, debug info
        ├── admin/             Song management (ROLE_ADMIN)
        └── docs/              Swagger JSON spec
  │
  └── PostgreSQL (Docker)
```

**Concurrency:** Lyrics generation uses an atomic Prisma `updateMany` lock (`lyrics_status`, `locked_at`, `generation_id`) to prevent duplicate GPT calls under concurrent requests. Stale locks auto-expire after 5 minutes.

**Streaming:** GPT output is streamed as NDJSON — one JSON line per lyric. The client renders each line as it arrives. Cached songs load instantly from DB in the same format.

**Lazy detail loading:** Songs created via search or Spotify import store only basic info (genius_id, title, artist, cover). Full metadata (album, description, streaming links, featured artists) is fetched from Genius on first page visit and cached in DB.

**Description translation:** English descriptions are auto-translated via GPT-4o-mini on first visit. The translation is cached in `description_ko` — subsequent visits return it instantly from the server with no API call.

**Spotify 2026 Feb migration:** Playlist endpoints use `/items` instead of `/tracks`, `item.item` instead of `item.track`. Only user-owned playlists can be imported (Spotify restriction).

---

## Database Schema

```
User ──< Account        (one user, many OAuth providers)
User ──< Session        (NextAuth sessions)
User ──< SearchHistory  (per-user, updatedAt for recency sorting)
User ──< Playlist ──< PlaylistSong ──> Song

Song ──1 SongLyricsRaw  (cached raw scraped text + Genius annotations)
Song ──< LyricLine      (interpreted lines: original, translation, slang, explanation)

OAuthState              (PKCE state tokens, TTL 10 min, auto-purged)
```

**Key fields on `Song`:**

| Field | Type | Purpose |
|---|---|---|
| `genius_id` | String (unique) | Genius song ID — used for dedup and linking |
| `genius_path` | String | Genius URL path — used for scraping |
| `genius_artist_id` | String? | Links to `/artists/[id]` page |
| `genius_album_id` | String? | Links to `/albums/[id]` page |
| `featured_artists` | Json? | `Array<{id, name}>` — rendered in song header |
| `description` | Text? | English description from Genius |
| `description_ko` | Text? | Cached Korean translation |
| `lyrics_status` | Enum | `NONE` → `PROCESSING` → `DONE` |
| `locked_at` | DateTime? | Set when `PROCESSING` begins; stale after 5 min |

**`Playlist` model:**

| Field | Type | Purpose |
|---|---|---|
| `name` | String | Unique per user |
| `isDefault` | Boolean | Auto-created "찜한 곡" list, cannot be deleted |
| `userId_name` | Unique | Prevents duplicate names per user |

**`PlaylistSong` model:** Links Song to Playlist with `position` for drag-and-drop ordering.

---

## API Reference

Interactive docs available at `/docs` (Swagger UI).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/songs/search?q=&page=` | — | Search songs via Genius (paginated, 60s cache) |
| `POST` | `/api/songs` | — | Create song with basic info (detail lazy-loaded) |
| `GET` | `/api/songs/:id/lyrics` | — | Lyrics stream (NDJSON) or 202 if generating |
| `POST` | `/api/songs/:id/translate-description` | — | Translate description to Korean (cached) |
| `GET` | `/api/search?q=&type=&page=` | — | Unified search: songs, artists, albums |
| `GET` | `/api/playlists` | Session | List playlists with song count |
| `POST` | `/api/playlists` | Session | Create playlist (50 limit) |
| `DELETE` | `/api/playlists/:id` | Session | Delete playlist (not default) |
| `GET` | `/api/playlists/:id/songs` | Session | Playlist songs ordered by position |
| `POST` | `/api/playlists/:id/songs` | Session | Add song (idempotent) |
| `DELETE` | `/api/playlists/:id/songs/:songId` | Session | Remove song |
| `PUT` | `/api/playlists/:id/songs/reorder` | Session | Bulk reorder |
| `GET` | `/api/songs/:id/playlists` | Session | Which playlists contain this song |
| `POST` | `/api/playlists/import/spotify` | Session | Import Spotify playlist |
| `GET` | `/api/spotify/playlists` | Session | List Spotify playlists |
| `GET` | `/api/spotify/now-playing` | Session | Currently playing track |
| `GET` | `/api/user/search-history?cursor=&limit=` | Session | Paginated search history |
| `POST` | `/api/user/search-history` | Session | Upsert search history entry |
| `DELETE` | `/api/user/search-history?genius_id=` | Session | Delete history entry |
| `GET` | `/api/user/accounts` | Session | Linked OAuth accounts |
| `DELETE` | `/api/user/accounts?provider=` | Session | Unlink account (min 1 required) |
| `PATCH` | `/api/user/profile` | Session | Update nickname (20 char limit) |
| `GET` | `/api/system/health` | — | Health check |
| `GET` | `/api/admin/songs` | ROLE_ADMIN | Paginated song list |
| `DELETE` | `/api/admin/songs/:id` | ROLE_ADMIN | Delete song |
| `POST` | `/api/admin/songs/:id/reset` | ROLE_ADMIN | Reset lyrics status |

**Rate limits:** 5 req/min on lyrics, 30 req/min on search, 60 req/min default (per IP).

---

## GPT Prompt Design

Lyrics interpretation is driven by a detailed system prompt in `lib/gpt.ts`. The prompt is structured in two parts.

### Interpretation Rules (rules 1–13)

**Rule 1 — Adaptive tone & register**
The model identifies the genre and mood, then selects the appropriate Korean register:
- **Hip-Hop / Rap**: 반말 + 거리체. Subgenre layers: Trap (melodic melancholy + flex), UK Drill (cold/menacing, dense UK slang), Conscious Rap (meaning > flow)
- **R&B / Soul**: Sensual and warm. Preserve intimacy.
- **Pop**: Bright, singable, emotionally accessible.
- **Rock / Alternative / Punk**: Raw, rebellious, rough edges intentional.
- **K-Pop**: Preserve intentional English code-switching.
- **J-Pop / City Pop**: Melancholic, nostalgic, wistful.
- Plus: EDM, Folk, Metal, Gospel, Latin, Indie, Jazz, Country.

**Rule 2–6** — Multilingual code-switching, contextual metaphors, slang detection (curated glossary), punchline capture, AAVE decoding, phonetic wordplay.

**Rules 7–12** — Accurate pronouns, Genius annotation priority, preserve proper nouns, consistent repeated lines, rhyme awareness, no censorship.

**Rule 13 — Romaji → Japanese script** — romanized Japanese lyrics auto-converted to kanji/hiragana/katakana.

### Output Format

NDJSON — one JSON object per line, streamed in order:

```jsonc
{"line":1,"original":"Bitch, be humble","translation":"씨발년아, 꼬락서니나 봐","slang":null,"explanation":"켄드릭이 허세 부리는 래퍼들을 향해 던지는 직격 한 방."}
{"line":2,"original":"[Chorus]","translation":null,"slang":null,"explanation":null}
```

### Token Limit Handling

If `finish_reason === "length"`, the generator resumes from the last confirmed line number in a new API call. Long songs are processed in multiple passes without data loss.

---

## Testing

```bash
npm test           # watch mode
npm run test:run   # single run
```

Tests cover: Genius API client, lyrics scraper, GPT streaming parser, api-error helper, lyrics route (atomic lock logic), admin songs route (RBAC).

---

## Deployment

```bash
cp .env.example .env
# fill in .env values
docker compose up -d
```

Nginx serves on port 80 with `proxy_buffering off` on `/api/songs/` routes to preserve NDJSON streaming.
