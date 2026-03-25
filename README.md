# under-line

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Genius](https://img.shields.io/badge/Genius-API-FFFF64?style=flat-square&logoColor=black)

**가사 한 줄 한 줄의 숨겨진 의미를 찾아드립니다.**

> "번역" (X)
> "이 줄에서 아티스트가 말하는 건 사실 이거야" (O)

---

## Production

- **App**: https://underline.rheon.kr
- **API Docs**: https://underline.rheon.kr/docs
- **Health**: https://underline.rheon.kr/api/system/health

---

## Features

- **Line-by-line translation** — every lyric translated to Korean in context
- **AI interpretation** — slang, cultural references, and hidden meanings per line
- **Genius annotations** — community notes used as source material for GPT
- **Streaming UX** — results appear line by line as they're generated; instant load on repeat visits
- **Artist & album pages** — browse an artist's discography or an album's track list; click any track to open it directly
- **Genius Romanizations support** — Japanese songs listed under Genius Romanizations are automatically resolved to the original Japanese page, so lyrics are always in native script
- **Spotify integration** — see the song you're currently listening to in the sidebar; link your Spotify account from your profile
- **Multilingual** — English, Japanese, Spanish, and more; Korean songs skip translation and go straight to interpretation
- **OAuth login** — Google and Spotify; link both to one account from your profile
- **Admin panel** — paginated song list, per-song delete, lyrics status reset (ROLE_ADMIN only)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Node Runtime) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Database | PostgreSQL 16 + Prisma 7 ORM |
| Auth | NextAuth.js v5 (Google + Spotify OAuth) |
| AI | OpenAI GPT-4o (NDJSON streaming) |
| Lyrics source | Genius API + HTML scraping (Cheerio) |
| Music | Spotify Web API |
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
  │   ├── page.tsx             Home — search + recent songs
  │   ├── songs/[id]/          Song detail — header, LyricsView, YouTube, AlbumTrackList
  │   ├── artists/[id]/        Artist — photo, bio, top 10 songs
  │   ├── albums/[id]/         Album — cover, full track list
  │   ├── login/               OAuth login buttons
  │   ├── profile/             Linked accounts, logout
  │   └── docs/                Swagger UI
  │
  └── app/api/
        ├── auth/              NextAuth (Google + Spotify)
        ├── oauth/[provider]/  Custom PKCE OAuth flow
        ├── songs/             Search, upsert, metadata, NDJSON lyrics stream
        ├── spotify/           Now playing
        ├── user/              Search history, linked accounts
        ├── system/            Health check, debug info
        ├── admin/             Song management (ROLE_ADMIN)
        └── docs/              Swagger JSON spec
  │
  └── PostgreSQL (Docker)
```

**Concurrency:** Lyrics generation uses an atomic Prisma `updateMany` lock (`lyrics_status`, `locked_at`, `generation_id`) to prevent duplicate GPT calls under concurrent requests. Stale locks auto-expire after 5 minutes.

**Streaming:** GPT output is streamed as NDJSON — one JSON line per lyric. The client renders each line as it arrives. Cached songs load instantly from DB in the same format.

**Genius Romanizations:** Songs listed under the "Genius Romanizations" artist are detected by path prefix (`/genius-romanizations-`). The scraper follows `song_relationships` to fetch the original Japanese page, and the real artist ID is resolved from the original song's `primary_artist`.

**Caching:** Genius artist and album data is cached via Next.js `fetch` revalidation (albums: 24h, artists: 24h, artist songs: 1h). Search results use a 60s in-memory Map cache.

---

## Why No LangChain

LangChain is useful for RAG pipelines, multi-LLM chains, and dynamic agent tool selection. This project does none of that — it's a single GPT-4o call per song with NDJSON streaming. Adding LangChain would only increase bundle size and introduce an abstraction layer that makes streaming and error handling harder to debug. The OpenAI SDK is called directly in `lib/gpt.ts`.

## GPT Prompt Design

Lyrics interpretation is driven by a detailed system prompt in `lib/gpt.ts`. The prompt is structured in two parts.

### Interpretation Rules (rules 1–13)

**Rule 1 — Adaptive tone & register**
The model first identifies the genre and mood of the song, then selects the appropriate Korean register. Rules are defined per genre:
- **Hip-Hop / Rap**: 반말 + 거리체 mandatory. Swagger, aggression, and punchlines must land. A "VIBE CHECK" is included — after translating, the model asks "Would a Korean rapper actually say this?" If it sounds like a textbook, it must redo it.
  - Subgenre-specific layers: Trap (melodic melancholy + flex), UK Drill (cold/menacing, dense UK slang like *mandem*, *ting*, *peng*, *roadman*), Conscious Rap (meaning > flow, decode every allusion)
- **R&B / Soul**: Sensual and warm. Preserve intimacy.
- **Pop**: Bright, singable, emotionally accessible.
- **Ballad**: Lyrical and poetic. Every word carries weight.
- **Rock / Alternative / Punk**: Raw, rebellious, rough edges are intentional.
- **K-Pop**: Preserve intentional English code-switching — do not translate stylistic English phrases.
- **J-Pop / City Pop**: Melancholic, nostalgic, wistful.
- Plus: EDM, Folk, Metal, Gospel, Latin/Reggaeton, Indie/Lo-fi, Jazz, Country.

**Rule 2 — Multilingual code-switching**
Translate non-Korean segments. When a foreign word is used for cultural flavor (Drake's French, Cardi B's Spanish), note it in `slang` and translate the meaning — don't transliterate blindly.

**Rule 3 — Contextual metaphors**
No dictionary-style literal translations. Idioms and metaphors must land naturally in Korean.

**Rule 4 — Slang detection**
Assumes every word is slang until proven otherwise. Includes a curated reference glossary:
> `cheese / bread / paper` = 돈 · `whip` = 고급차 · `heat / iron / stick` = 총 · `plug` = 마약상 · `trap` = 마약 판매 거점 · `sauce` = 스타일 · `drip` = 럭셔리 패션 · `function` = 파티 · `ice` = 보석 플렉스 · `mandem` = 패거리 · `Ms / M's` = millions · ...

**Rule 5 — Punchlines & irony**
Never translate punchlines literally — capture the punch, rhythm, and comedic/aggressive impact. The test: *read it out loud. Does it HIT?*

**Rule 6 — AAVE & double entendres**
Accurate decoding of AAVE grammar (`he stay flexing`, `finna`, `tryna`, `on sight`). Weapon slang that doubles as sexual/phallic imagery (when context is clearly sexual) is translated at the comedic layer, not the literal weapon layer.

**Rule 6b — Phonetic wordplay & euphemisms**
Sound-alike substitutes (e.g., "funk" as stand-in for "fuck") are translated at the intended meaning, with the phonetic substitution explained in `slang`.

**Rules 7–12** — Accurate pronouns, Genius annotation priority, preserve proper nouns/brands, consistent repeated lines, rhyme awareness, no censorship (full original intensity).

**Rule 13 — Romaji → Japanese script (mandatory)**
If input lyrics are romanized Japanese (e.g., `"Mou wasurete shimatta ka na"`), every `original` field must be converted to kanji/hiragana/katakana. This fires before GPT processes the rest of the line. If a single kanji is unknown, hiragana is used for that word — but romaji is never left in the output.
> `"Mou wasurete shimatta ka na"` → `"もう忘れてしまったかな"`

### Structural Rules (rules 14–16)

| Rule | Applies to | Behavior |
|---|---|---|
| 14 | Section tags (`[Verse 1]`, `[Chorus]`, ...) | `original` = tag verbatim, all other fields null |
| 15 | Blank lines | `original` = `""`, all other fields null |
| 16 | Completeness | Every line must be processed, no skipping, 1-based sequential numbering |

### Output Format

NDJSON — one JSON object per line, no markdown fences, no preamble. The first character of output must be `{`.

```jsonc
// One object per lyric line, streamed in order:
{"line":1,"original":"Bitch, be humble","translation":"씨발년아, 꼬락서니나 봐","slang":null,"explanation":"켄드릭이 허세 부리는 래퍼들을 향해 던지는 직격 한 방."}
{"line":2,"original":"[Chorus]","translation":null,"slang":null,"explanation":null}
{"line":3,"original":"","translation":null,"slang":null,"explanation":null}
```

### Token Limit Handling

GPT-4o has a finite context window. `streamLyricInterpretations` handles truncation automatically: if `finish_reason === "length"`, the generator resumes a new API call from the last confirmed processed line number, passing the remaining lyrics with a line offset instruction. Long songs are processed in multiple passes without data loss.

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
- Required scopes: `user-read-currently-playing`, `user-read-playback-state`, `user-read-email`

---

## Database Schema

```
User ──< Account        (one user, many OAuth providers)
User ──< Session        (NextAuth sessions)
User ──< SearchHistory  (per-user search history)

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
| `lyrics_status` | Enum | See state machine below |
| `locked_at` | DateTime? | Set when `PROCESSING` begins; stale after 5 min |
| `generation_id` | String? | UUID per generation run — used to detect stale writes |

**`LyricsStatus` state machine:**

```
         first request
NONE ──────────────────► PROCESSING
                              │
              ┌───────────────┤
              │               │
         GPT done         GPT error / server crash
              │               │
              ▼               ▼
            DONE           NONE (reset)
              │
         re-generate
         (admin reset)
              │
              ▼
            NONE
```

Stale lock recovery: if `locked_at` is older than 5 minutes and `lyrics_status` is still `PROCESSING`, the next request treats the lock as expired and re-acquires it via atomic `updateMany`.

---

## OAuth Flow

The app uses **two parallel OAuth flows**:

**1. NextAuth (Google login only)**
Standard NextAuth sign-in flow. Handles session creation and the `User` + `Account` records.

**2. Custom PKCE flow (`/api/oauth/[provider]`)** — used for Spotify and for linking a second provider to an existing account

NextAuth doesn't natively support adding a second OAuth provider to an already-authenticated account ("account linking"). The custom flow handles this:

```
User clicks "Connect Spotify"
        │
        ▼
GET /api/oauth/spotify?callbackUrl=/profile
  - Detect session → mode = 'link' (or 'login' if no session)
  - Generate PKCE verifier + SHA-256 challenge
  - Store OAuthState { mode, userId, codeVerifier, expiresAt: +10min } in DB
  - Redirect → Spotify authorization URL (state = OAuthState.id)
        │
        ▼
Spotify redirects → GET /api/oauth/spotify/callback?code=...&state=...
  - Look up OAuthState by state param (CSRF check — state is a CUID, unguessable)
  - Exchange code + verifier for access/refresh tokens (PKCE)
  - mode = 'link': attach new Account to existing User
  - mode = 'login': find or create User, create session
  - Delete used OAuthState, redirect to callbackUrl
```

Why DB-backed state instead of a signed cookie? The state token carries the PKCE verifier which must survive a full browser round-trip to Spotify and back. Storing it in the DB (with 10-minute TTL and auto-purge of expired rows) avoids cookie size limits and makes the verifier server-side-only.

---

## Project Structure

```
app/
├── api/
│   ├── admin/songs/          Paginated list, delete, reset (ROLE_ADMIN)
│   ├── auth/                 NextAuth
│   ├── docs/                 Swagger JSON
│   ├── oauth/[provider]/     Custom PKCE OAuth flow
│   ├── songs/                Search, upsert, metadata, NDJSON lyrics stream
│   ├── spotify/              Now playing
│   ├── system/               Health check, debug
│   └── user/                 Search history, linked accounts
└── (main)/
    ├── page.tsx              Home
    ├── songs/[id]/           Song detail
    ├── artists/[id]/         Artist page
    ├── albums/[id]/          Album page
    ├── login/                OAuth login
    ├── profile/              Account management
    └── docs/                 Swagger UI

lib/
├── prisma.ts                 Singleton DB client
├── auth.ts                   NextAuth config
├── auth-guard.ts             requireAdmin + withAdmin HOF
├── api-error.ts              Structured error response helper
├── genius.ts                 Genius API client (search, songs, albums, artists)
├── scraper.ts                Cheerio-based Genius lyrics scraper
├── gpt.ts                    GPT-4o NDJSON streaming interpreter
├── lyrics-service.ts         determineLyricsAction (Service Layer)
├── strings.ts                Shared text utilities (Romanization cleanup)
├── logger.ts                 Structured JSON logger
├── rate-limit.ts             In-memory sliding window rate limiter
├── oauth-providers.ts        OAuth provider configs
├── pkce.ts                   PKCE code verifier/challenge
└── spotify.ts                Spotify Web API client

components/
├── lyrics/                   LyricLine, InterpretationPanel, LyricsView
├── search/                   SearchBar (debounce, history, keyboard nav)
└── song/                     AlbumTrackList, NowPlaying
```

---

## API Reference

Interactive docs available at `/docs` (Swagger UI).

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/songs/search?q=` | — | Search songs via Genius (60s cache) |
| `POST` | `/api/songs` | — | Upsert song metadata to DB |
| `GET` | `/api/songs/:id` | — | Song metadata |
| `GET` | `/api/songs/:id/lyrics` | — | Lyrics stream (NDJSON) or 202 if generating |
| `GET` | `/api/spotify/now-playing` | Session | Currently playing track |
| `GET` | `/api/user/search-history` | Session | Recent searches |
| `DELETE` | `/api/user/search-history` | Session | Remove a search history entry |
| `GET` | `/api/user/accounts` | Session | Linked OAuth accounts |
| `GET` | `/api/system/health` | — | Health check |
| `GET` | `/api/admin/songs` | ROLE_ADMIN | Paginated song list |
| `DELETE` | `/api/admin/songs/:id` | ROLE_ADMIN | Delete song |
| `POST` | `/api/admin/songs/:id/reset` | ROLE_ADMIN | Reset lyrics status to NONE |

**Rate limits:** 5 req/min on lyrics, 30 req/min on search, 60 req/min default (per IP).

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
