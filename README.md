# under-line

Discover the hidden meaning behind lyrics — line by line.

Search any song, get Korean translations and AI-powered interpretations for every line. Click a line to see slang explanations and cultural context drawn from Genius community annotations.

---

## Features

- **Line-by-line translation** — every lyric translated to Korean in context
- **AI interpretation** — slang, cultural references, and hidden meanings per line
- **Genius annotations** — community notes used as source material for GPT
- **Streaming UX** — results appear line by line as they're generated; instant load on repeat visits
- **Spotify integration** — interpret the song you're currently listening to in one click
- **Multilingual** — English, Japanese, Spanish, and more; Korean songs skip translation and go straight to interpretation
- **OAuth login** — Google and Spotify; link both to one account from your profile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Node Runtime) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js v5 (Google + Spotify OAuth) |
| AI | OpenAI GPT-4o (NDJSON streaming) |
| Lyrics source | Genius API + HTML scraping (cheerio) |
| Music | Spotify Web API |
| API docs | Swagger UI (`/docs`) |
| Testing | Vitest + React Testing Library |
| Deployment | Docker + Nginx |

---

## Architecture

```
Browser
  │
  ├── fetch / NDJSON stream
  │
Next.js App Router (Node Runtime)
  ├── app/(main)/          UI pages
  └── app/api/
        ├── auth/          NextAuth (Google + Spotify)
        ├── songs/search   Genius search
        ├── songs/[id]     Song metadata
        ├── songs/[id]/lyrics   Scrape + GPT stream
        ├── spotify/       Now playing, Liked Songs
        └── docs/          Swagger JSON
  │
  └── PostgreSQL (Docker)
```

**Concurrency:** First-visit lyrics generation uses an atomic DB lock (`lyrics_status`, `locked_at`) to prevent duplicate GPT calls under concurrent requests. Stale locks auto-expire after 5 minutes.

**Streaming:** GPT output is streamed as NDJSON — one JSON line per lyric. The client renders each line as it arrives. Cached songs load instantly from DB in the same format.

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

Copy `.env.local` and fill in values:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/underline"
AUTH_SECRET=""                  # openssl rand -base64 32

AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

SPOTIFY_CLIENT_ID=""
SPOTIFY_CLIENT_SECRET=""

GENIUS_ACCESS_TOKEN=""
OPENAI_API_KEY=""
```

OAuth redirect URIs to register:
- Google: `http://localhost:3000/api/auth/callback/google`
- Spotify: `http://localhost:3000/api/auth/callback/spotify`

```bash
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000`.

---

## Project Structure

```
app/
├── api/                  Route Handlers (backend)
│   ├── auth/
│   ├── docs/             Swagger endpoint
│   ├── songs/
│   └── spotify/
└── (main)/               Pages
    ├── page.tsx           Home (state-based: Spotify / default)
    ├── songs/[id]/        Lyrics page
    ├── profile/           Account linking
    └── docs/              Swagger UI

lib/                      Business logic
├── prisma.ts
├── auth.ts
├── genius.ts
├── scraper.ts
├── gpt.ts
└── spotify.ts

components/
├── home/
├── lyrics/
├── search/
└── profile/
```

---

## API Reference

Interactive docs available at `/docs` (Swagger UI).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/songs/search?q=` | Search songs via Genius |
| `POST` | `/api/songs` | Upsert song to DB |
| `GET` | `/api/songs/:id` | Song metadata |
| `GET` | `/api/songs/:id/lyrics` | Lyrics + translation + interpretation (NDJSON stream) |
| `GET` | `/api/spotify/now-playing` | Currently playing track |
| `GET` | `/api/spotify/liked-songs` | Liked Songs list |

---

## Deployment

```bash
# Build and run with Docker + Nginx
cp .env.local .env
docker compose up -d
```

Nginx serves on port 80 with `proxy_buffering off` on `/api/songs/` routes to preserve NDJSON streaming.

---

## Testing

```bash
npm test           # watch mode
npm run test:run   # single run
```

---

## Implementation Plans

- [`docs/superpowers/plans/2026-03-24-plan-a-foundation-and-lyrics.md`](docs/superpowers/plans/2026-03-24-plan-a-foundation-and-lyrics.md) — DB, Auth, Genius, GPT streaming, lyrics UI, Swagger, rate limiting
- [`docs/superpowers/plans/2026-03-24-plan-b-spotify-home-profile-docker.md`](docs/superpowers/plans/2026-03-24-plan-b-spotify-home-profile-docker.md) — Spotify integration, home UI, profile, Nginx + Docker
