# Under-Line Plan A: Foundation + Core Lyrics Feature

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB 세팅, Google/Spotify OAuth 로그인, Genius 검색, 가사 스크래핑, GPT NDJSON 스트리밍, 가사 페이지 UI, Swagger 문서까지 동작하는 상태

**Architecture:** Next.js 16 App Router 단일 앱. Route Handlers가 백엔드 역할. Prisma로 PostgreSQL 연동. NextAuth v5로 Google + Spotify OAuth 처리.

**Tech Stack:** Next.js 16, TypeScript, Tailwind 4, Prisma, PostgreSQL, NextAuth.js v5, OpenAI SDK, cheerio, next-swagger-doc, swagger-ui-react, Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-under-line-design.md`

---

## File Map

```
prisma/
└── schema.prisma

lib/
├── prisma.ts                              ← Prisma 클라이언트 싱글톤
├── auth.ts                                ← NextAuth 설정
├── auth-guard.ts                          ← requireAuth / requireAdmin
├── api-error.ts                           ← 표준 에러 응답 헬퍼
├── logger.ts                              ← 요청/응답 로깅
├── genius.ts                              ← Genius API 클라이언트
├── scraper.ts                             ← HTML 스크래핑
└── gpt.ts                                 ← OpenAI NDJSON 스트리밍

app/
├── layout.tsx
├── api/
│   ├── auth/[...nextauth]/route.ts
│   ├── health/route.ts                    ← GET 헬스체크
│   ├── docs/route.ts                      ← Swagger JSON 엔드포인트
│   ├── admin/
│   │   └── songs/
│   │       ├── route.ts                   ← GET 전체 곡 목록 (admin)
│   │       └── [id]/
│   │           ├── route.ts               ← DELETE 곡 삭제 (admin)
│   │           └── reset/route.ts         ← POST 강제 재생성 (admin)
│   └── songs/
│       ├── route.ts                       ← POST 곡 upsert
│       ├── search/route.ts                ← GET ?q= 검색
│       ├── [id]/route.ts                  ← GET 곡 메타데이터
│       └── [id]/lyrics/route.ts          ← GET NDJSON 스트리밍
├── (main)/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/page.tsx
│   ├── songs/[id]/page.tsx
│   └── docs/page.tsx                      ← Swagger UI 페이지

components/
├── search/SearchBar.tsx
└── lyrics/
    ├── LyricsView.tsx
    ├── LyricLine.tsx
    └── InterpretationPanel.tsx

types/
├── index.ts                               ← 공유 타입
└── next-auth.d.ts                         ← NextAuth 세션 타입 확장

__tests__/
├── lib/gpt.test.ts
├── lib/scraper.test.ts
├── lib/api-error.test.ts
├── api/songs-lyrics.test.ts
└── api/admin-songs.test.ts
```

---

## Task 1: 패키지 설치 및 환경 설정

**Files:**
- Modify: `package.json`
- Create: `.env.local` (이미 존재, 값 추가)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: 패키지 설치**

```bash
npm install @prisma/client next-auth@beta @auth/prisma-adapter \
  openai cheerio @types/cheerio next-swagger-doc swagger-ui-react
npm install -D prisma vitest @vitejs/plugin-react \
  @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: .env.local에 필요한 변수 추가**

기존 Genius 키 아래에 추가:

```env
# DB
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/underline"

# NextAuth
AUTH_SECRET="openssl rand -base64 32 결과값 입력"

# Google OAuth (console.cloud.google.com에서 발급)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# OpenAI
OPENAI_API_KEY=

# Spotify OAuth (developer.spotify.com에서 발급)
# Redirect URI: http://localhost:3000/api/auth/callback/spotify
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

> Google OAuth Redirect URI: `http://localhost:3000/api/auth/callback/google`
> Spotify OAuth Redirect URI: `http://localhost:3000/api/auth/callback/spotify`

- [ ] **Step 3: Vitest 설정**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    clearMocks: true,  // 각 테스트마다 자동으로 mock 초기화
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: package.json scripts 추가**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest",
  "test:run": "vitest --run"
}
```

- [ ] **Step 5: 실행 확인**

```bash
npm run test:run
```
Expected: "No test files found" (에러 없으면 OK)

- [ ] **Step 6: 커밋**

```bash
git add vitest.config.ts vitest.setup.ts package.json
git commit -m "feat: vitest setup and project dependencies"
```

---

## Task 2: Prisma 스키마 및 DB 마이그레이션

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`

- [ ] **Step 1: Prisma 초기화**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: schema.prisma 작성**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── NextAuth 필수 테이블 ───────────────────────────────
model User {
  id         String    @id @default(cuid())
  name       String?
  email      String?   @unique
  image      String?
  role       Role      @default(ROLE_USER)
  accounts   Account[]
  sessions   Session[]
  created_at DateTime  @default(now())
}

enum Role { ROLE_USER ROLE_ADMIN }

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

// ─── 앱 도메인 테이블 ──────────────────────────────────
model Song {
  id            String       @id @default(cuid())
  genius_id     String       @unique
  title         String
  artist        String
  image_url     String?
  genius_path   String
  lyrics_status LyricsStatus @default(NONE)
  locked_at     DateTime?
  generation_id String?
  created_at    DateTime     @default(now())

  raw   SongLyricsRaw?
  lines LyricLine[]
}

model SongLyricsRaw {
  id         String   @id @default(cuid())
  song_id    String   @unique
  raw_text   String   @db.Text
  scraped_at DateTime @default(now())
  song       Song     @relation(fields: [song_id], references: [id])
}

model LyricLine {
  id            String  @id @default(cuid())
  song_id       String
  line_number   Int
  original      String
  translation   String? // null = 원문이 한국어
  slang         String? @db.Text
  explanation   String? @db.Text
  generation_id String
  song          Song    @relation(fields: [song_id], references: [id])

  @@unique([song_id, line_number])
}

enum LyricsStatus {
  NONE
  PROCESSING
  DONE
  FAILED
}
```

- [ ] **Step 3: 마이그레이션 실행**

```bash
npx prisma migrate dev --name init
```
Expected: "Your database is now in sync with your schema."

- [ ] **Step 4: Prisma 클라이언트 싱글톤**

```ts
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['query'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

> Next.js dev 모드 Hot Reload 시 인스턴스 중복 생성 방지 패턴.

- [ ] **Step 5: 커밋**

```bash
git add prisma/ lib/prisma.ts
git commit -m "feat: prisma schema and db migration"
```

---

## Task 3: 공유 타입 정의

**Files:**
- Create: `types/index.ts`
- Create: `types/next-auth.d.ts`

- [ ] **Step 1: 공유 타입**

```ts
// types/index.ts
export interface SongMeta {
  id: string
  genius_id: string
  title: string
  artist: string
  image_url: string | null
  genius_path: string
}

export interface LyricLineData {
  line_number: number
  original: string
  translation: string | null  // null = 원문이 한국어
  slang: string | null
  explanation: string | null
}

export interface GeniusSearchResult {
  genius_id: string
  title: string
  artist: string
  image_url: string | null
  genius_path: string
}

// Genius API 응답 hit 타입
export interface GeniusHit {
  type: string
  result: {
    id: number
    title: string
    artist_names: string
    song_art_image_thumbnail_url: string | null
    path: string
  }
}

// NDJSON 스트리밍 이벤트
export type StreamEvent =
  | { type: 'line'; data: LyricLineData }
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'processing' }

// ─── RBAC ───────────────────────────────────────────────
export type Role = 'ROLE_USER' | 'ROLE_ADMIN'

// ─── 에러 코드 (15개) ────────────────────────────────────
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SONG_NOT_FOUND'
  | 'LYRICS_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'LYRICS_PROCESSING'
  | 'GENIUS_API_ERROR'
  | 'OPENAI_API_ERROR'
  | 'SPOTIFY_AUTH_ERROR'
  | 'SCRAPING_FAILED'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR'

// ─── 표준 에러 응답 ────────────────────────────────────
export interface ApiErrorResponse {
  timestamp: string
  path: string
  status: number
  code: ErrorCode
  message: string
  details: unknown | null
}

// ─── 페이지네이션 ───────────────────────────────────────
export interface PaginationMeta {
  page: number
  size: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}
```

- [ ] **Step 2: NextAuth 세션 타입 확장**

```ts
// types/next-auth.d.ts
import { DefaultSession } from 'next-auth'
import { Role } from './index'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession['user']
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add types/
git commit -m "feat: shared TypeScript types"
```

---

## Task 4: NextAuth 설정 (Google + Spotify OAuth)

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/(main)/login/page.tsx`

- [ ] **Step 1: NextAuth 설정 파일**

```ts
// lib/auth.ts
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Spotify from 'next-auth/providers/spotify'
import { prisma } from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'user-read-email',
            'user-read-currently-playing',
            'user-read-playback-state',
            'user-library-read',
          ].join(' '),
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      // role은 DB User 테이블에서 가져옴 (PrismaAdapter가 user 객체 제공)
      session.user.role = (user as { role: string }).role as import('@/types').Role
      return session
    },
    async signIn({ account, profile }) {
      // 같은 이메일로 다른 provider 로그인 시 기존 User에 Account 연결
      if (!account || !profile?.email) return true

      const existingUser = await prisma.user.findUnique({
        where: { email: profile.email as string },
        include: { accounts: true },
      })

      if (existingUser) {
        const alreadyLinked = existingUser.accounts.some(
          (a) => a.provider === account.provider
        )
        if (!alreadyLinked) {
          await prisma.account.create({
            data: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            },
          })
        }
      }
      return true
    },
  },
  pages: {
    signIn: '/login',
  },
})
```

- [ ] **Step 2: Route Handler**

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 3: 로그인 페이지**

```tsx
// app/(main)/login/page.tsx
import { signIn } from '@/lib/auth'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-4">
      <form
        action={async () => {
          'use server'
          await signIn('google', { redirectTo: '/' })
        }}
      >
        <button type="submit" className="rounded-lg bg-white px-6 py-3 font-medium shadow border">
          Google로 로그인
        </button>
      </form>
      <form
        action={async () => {
          'use server'
          await signIn('spotify', { redirectTo: '/' })
        }}
      >
        <button type="submit" className="rounded-lg bg-green-500 px-6 py-3 font-medium text-white">
          Spotify로 로그인
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: 수동 테스트**

```bash
npm run dev
```
- `http://localhost:3000/login` 접속
- Google 로그인 → OAuth 완료 → 홈 리디렉트 확인
- `npx prisma studio` → User, Account 테이블 레코드 확인

- [ ] **Step 5: 커밋**

```bash
git add lib/auth.ts "app/api/auth" "app/(main)/login"
git commit -m "feat: NextAuth with Google and Spotify OAuth"
```

---

## Task 5: Genius API 클라이언트

**Files:**
- Create: `lib/genius.ts`
- Create: `__tests__/lib/genius.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// __tests__/lib/genius.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { GeniusHit } from '@/types'

global.fetch = vi.fn()

describe('searchSongs', () => {
  it('검색 결과를 GeniusSearchResult 배열로 반환한다', async () => {
    const mockHit: GeniusHit = {
      type: 'song',
      result: {
        id: 12345,
        title: 'HUMBLE.',
        artist_names: 'Kendrick Lamar',
        song_art_image_thumbnail_url: 'https://example.com/img.jpg',
        path: '/Kendrick-lamar-humble-lyrics',
      },
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        meta: { status: 200 },
        response: { hits: [mockHit] },
      }),
    } as Response)

    const { searchSongs } = await import('@/lib/genius')
    const results = await searchSongs('kendrick humble')

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      genius_id: '12345',
      title: 'HUMBLE.',
      artist: 'Kendrick Lamar',
      image_url: 'https://example.com/img.jpg',
      genius_path: '/Kendrick-lamar-humble-lyrics',
    })
  })

  it('song 타입이 아닌 hit은 필터링한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: { hits: [{ type: 'artist', result: {} }] },
      }),
    } as Response)

    const { searchSongs } = await import('@/lib/genius')
    const results = await searchSongs('test')
    expect(results).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 테스트 FAIL 확인**

```bash
npm run test:run -- __tests__/lib/genius.test.ts
```
Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// lib/genius.ts
import type { GeniusSearchResult, GeniusHit } from '@/types'

const BASE_URL = 'https://api.genius.com'

async function geniusFetch(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Genius API error: ${res.status}`)
  return res.json()
}

export async function searchSongs(query: string): Promise<GeniusSearchResult[]> {
  const params = new URLSearchParams({ q: query, per_page: '10' })
  const data = await geniusFetch(`/search?${params}`)

  return (data.response.hits as GeniusHit[])
    .filter((hit) => hit.type === 'song')
    .map((hit) => ({
      genius_id: String(hit.result.id),
      title: hit.result.title,
      artist: hit.result.artist_names,
      image_url: hit.result.song_art_image_thumbnail_url ?? null,
      genius_path: hit.result.path,
    }))
}

export async function getReferents(geniusSongId: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      song_id: geniusSongId,
      per_page: '50',
      text_format: 'plain',
    })
    const data = await geniusFetch(`/referents?${params}`)

    return (data.response.referents as Array<{
      fragment: string
      annotations: Array<{ body: { plain: string } }>
    }>)
      .map((ref) => {
        const annotation = ref.annotations?.[0]?.body?.plain ?? ''
        return `구절: "${ref.fragment}" / Genius 해설: ${annotation}`
      })
      .join('\n')
  } catch {
    return '' // referents 실패는 치명적이지 않음
  }
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- __tests__/lib/genius.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add lib/genius.ts __tests__/lib/genius.test.ts
git commit -m "feat: Genius API client"
```

---

## Task 6: 가사 스크래퍼

**Files:**
- Create: `lib/scraper.ts`
- Create: `__tests__/lib/scraper.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// __tests__/lib/scraper.test.ts
import { describe, it, expect } from 'vitest'
import { parseRawLyrics } from '@/lib/scraper'

describe('parseRawLyrics', () => {
  it('data-lyrics-container div에서 텍스트를 추출한다', () => {
    const html = `
      <html><body>
        <div data-lyrics-container="true">
          Sit down<br/>I'll pour the wine<br/>
          <a href="#">Talk all night</a>
        </div>
      </body></html>
    `
    const result = parseRawLyrics(html)
    expect(result).toContain("Sit down")
    expect(result).toContain("I'll pour the wine")
    expect(result).toContain("Talk all night")
  })

  it('[Verse], [Chorus] 섹션 태그를 보존한다', () => {
    const html = `
      <div data-lyrics-container="true">
        [Verse 1]<br/>Line one<br/>[Chorus]<br/>Line two
      </div>
    `
    const result = parseRawLyrics(html)
    expect(result).toContain('[Verse 1]')
    expect(result).toContain('[Chorus]')
    expect(result).toContain('Line one')
  })

  it('가사 컨테이너가 없으면 빈 문자열을 반환한다', () => {
    const html = '<html><body><p>No lyrics here</p></body></html>'
    expect(parseRawLyrics(html)).toBe('')
  })
})
```

- [ ] **Step 2: 테스트 FAIL 확인**

```bash
npm run test:run -- __tests__/lib/scraper.test.ts
```

- [ ] **Step 3: 구현**

```ts
// lib/scraper.ts
import * as cheerio from 'cheerio'

export function parseRawLyrics(html: string): string {
  const $ = cheerio.load(html)
  const segments: string[] = []

  $('[data-lyrics-container="true"]').each((_, container) => {
    $(container).find('br').replaceWith('\n')
    segments.push($(container).text())
  })

  if (segments.length === 0) return ''

  return segments
    .join('\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)  // 빈 줄 제거 (GPT 토큰 절약)
    .join('\n')
}

export async function scrapeLyrics(geniusPath: string): Promise<string> {
  const url = `https://genius.com${geniusPath}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })

  if (!res.ok) throw new Error(`Scraping failed: ${res.status} for ${url}`)

  const html = await res.text()
  const raw = parseRawLyrics(html)
  if (!raw) throw new Error('No lyrics container found on page')
  return raw
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- __tests__/lib/scraper.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add lib/scraper.ts __tests__/lib/scraper.test.ts
git commit -m "feat: Genius lyrics scraper"
```

---

## Task 7: GPT NDJSON 스트리밍

**Files:**
- Create: `lib/gpt.ts`
- Create: `__tests__/lib/gpt.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// __tests__/lib/gpt.test.ts
import { describe, it, expect } from 'vitest'
import { parseNdjsonLine } from '@/lib/gpt'

describe('parseNdjsonLine', () => {
  it('유효한 NDJSON 줄을 파싱한다', () => {
    const line = '{"line":1,"original":"Hello","translation":"안녕","slang":null,"explanation":null}'
    const result = parseNdjsonLine(line)

    expect(result).toEqual({
      line_number: 1,
      original: 'Hello',
      translation: '안녕',
      slang: null,
      explanation: null,
    })
  })

  it('빈 줄은 null을 반환한다', () => {
    expect(parseNdjsonLine('')).toBeNull()
    expect(parseNdjsonLine('   ')).toBeNull()
  })

  it('JSON이 아닌 줄은 null을 반환한다', () => {
    expect(parseNdjsonLine('not json')).toBeNull()
  })

  it('필수 필드가 없으면 null을 반환한다', () => {
    expect(parseNdjsonLine('{"missing":"fields"}')).toBeNull()
  })

  it('한국어 원문은 translation이 null이다', () => {
    const line = '{"line":2,"original":"안녕하세요","translation":null,"slang":null,"explanation":"인사말"}'
    const result = parseNdjsonLine(line)
    expect(result?.translation).toBeNull()
    expect(result?.explanation).toBe('인사말')
  })
})
```

- [ ] **Step 2: 테스트 FAIL 확인**

```bash
npm run test:run -- __tests__/lib/gpt.test.ts
```

- [ ] **Step 3: 구현**

```ts
// lib/gpt.ts
import OpenAI from 'openai'
import type { LyricLineData } from '@/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export function parseNdjsonLine(line: string): LyricLineData | null {
  if (!line.trim()) return null
  try {
    const obj = JSON.parse(line)
    if (typeof obj.line !== 'number' || typeof obj.original !== 'string') return null
    return {
      line_number: obj.line,
      original: obj.original,
      translation: obj.translation ?? null,
      slang: obj.slang ?? null,
      explanation: obj.explanation ?? null,
    }
  } catch {
    return null
  }
}

const SYSTEM_PROMPT = `
당신은 음악 가사 전문 해설가입니다. 가사를 한 줄씩 분석하고 아래 JSON 형식으로 출력합니다.
각 줄을 처리할 때마다 즉시 JSON 한 줄을 출력하세요 (NDJSON 형식).

출력 형식 (한 줄에 하나의 JSON):
{"line":<번호>,"original":"<원문>","translation":"<번역 또는 null>","slang":"<슬랭 1문장 또는 null>","explanation":"<설명 또는 null>"}

규칙:
- 원문이 한국어이면 translation은 반드시 null
- 슬랭/은어가 없으면 slang은 null (정확히 1문장)
- explanation: Genius 주석이 있으면 자연스러운 한국어로 번역 (출처 표기 금지, 내용만)
              추가할 내용 있을 때만 뒤에 덧붙임
              Genius 주석 없고 설명할 내용 없으면 null (억지로 채우지 말 것)
              최대 2-3문장
- [Verse], [Chorus] 등 섹션 태그는 original에 그대로, 나머지 필드는 null
`.trim()

export async function* streamLyricInterpretations(
  rawLyrics: string,
  referentsContext: string
): AsyncGenerator<LyricLineData> {
  const userMessage = [
    '가사:',
    rawLyrics,
    referentsContext ? `\nGenius 커뮤니티 주석 (참고용):\n${referentsContext}` : '',
  ].join('\n').trim()

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
  })

  let buffer = ''

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    buffer += delta

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const parsed = parseNdjsonLine(line)
      if (parsed) yield parsed
    }
  }

  if (buffer.trim()) {
    const parsed = parseNdjsonLine(buffer)
    if (parsed) yield parsed
  }
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- __tests__/lib/gpt.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add lib/gpt.ts __tests__/lib/gpt.test.ts
git commit -m "feat: GPT NDJSON streaming interpreter"
```

---

## Task 8: 검색 API

**Files:**
- Create: `app/api/songs/search/route.ts`

- [ ] **Step 1: 구현**

```ts
// app/api/songs/search/route.ts

/**
 * @swagger
 * /api/songs/search:
 *   get:
 *     summary: 곡 검색 (Genius API)
 *     tags: [Songs]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: 검색 키워드
 *     responses:
 *       200:
 *         description: 검색 결과 목록
 */
import { NextRequest } from 'next/server'
import { searchSongs } from '@/lib/genius'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 메모리 캐시 (60초 TTL)
const cache = new Map<string, { data: unknown; expires: number }>()

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return Response.json({ results: [] })

  // 캐시 확인
  const cached = cache.get(q)
  if (cached && cached.expires > Date.now()) {
    return Response.json({ results: cached.data })
  }

  try {
    const geniusResults = await searchSongs(q)
    const geniusIds = geniusResults.map((r) => r.genius_id)

    const cachedSongs = await prisma.song.findMany({
      where: { genius_id: { in: geniusIds } },
      select: { genius_id: true, id: true, lyrics_status: true },
    })
    const cacheMap = new Map(cachedSongs.map((s) => [s.genius_id, s]))

    const results = geniusResults.map((r) => ({
      ...r,
      db_id: cacheMap.get(r.genius_id)?.id ?? null,
      lyrics_status: cacheMap.get(r.genius_id)?.lyrics_status ?? null,
    }))

    cache.set(q, { data: results, expires: Date.now() + 60_000 })
    return Response.json({ results })
  } catch (error) {
    console.error('Search error:', error)
    return Response.json({ error: 'Search failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 수동 테스트**

```bash
curl "http://localhost:3000/api/songs/search?q=kendrick+lamar"
```
Expected: `{"results":[...]}`

- [ ] **Step 3: 커밋**

```bash
git add "app/api/songs/search"
git commit -m "feat: song search API with 60s cache"
```

---

## Task 9: 곡 upsert API + 메타데이터 API

**Files:**
- Create: `app/api/songs/route.ts`
- Create: `app/api/songs/[id]/route.ts`

- [ ] **Step 1: 곡 upsert (POST /api/songs)**

```ts
// app/api/songs/route.ts

/**
 * @swagger
 * /api/songs:
 *   post:
 *     summary: 곡 upsert (검색 결과 선택 시)
 *     tags: [Songs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GeniusSearchResult'
 *     responses:
 *       200:
 *         description: 생성 또는 기존 곡 ID
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { GeniusSearchResult } from '@/types'

export async function POST(request: NextRequest) {
  const body: GeniusSearchResult = await request.json()

  const song = await prisma.song.upsert({
    where: { genius_id: body.genius_id },
    create: {
      genius_id: body.genius_id,
      title: body.title,
      artist: body.artist,
      image_url: body.image_url,
      genius_path: body.genius_path,
    },
    update: {},
  })

  return Response.json({ id: song.id })
}
```

- [ ] **Step 2: 곡 메타데이터 (GET /api/songs/[id])**

```ts
// app/api/songs/[id]/route.ts

/**
 * @swagger
 * /api/songs/{id}:
 *   get:
 *     summary: 곡 메타데이터 조회
 *     tags: [Songs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 곡 메타데이터
 *       404:
 *         description: 곡 없음
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const song = await prisma.song.findUnique({
    where: { id },
    select: {
      id: true,
      genius_id: true,
      title: true,
      artist: true,
      image_url: true,
      genius_path: true,
      lyrics_status: true,
    },
  })

  if (!song) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(song)
}
```

- [ ] **Step 3: 커밋**

```bash
git add "app/api/songs/route.ts" "app/api/songs/[id]/route.ts"
git commit -m "feat: song upsert and metadata API"
```

---

## Task 10: 가사 생성 API (Atomic Lock + NDJSON 스트리밍)

**Files:**
- Create: `app/api/songs/[id]/lyrics/route.ts`
- Create: `__tests__/api/songs-lyrics.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// __tests__/api/songs-lyrics.test.ts
import { describe, it, expect, vi } from 'vitest'

// clearMocks: true가 vitest.config.ts에 설정되어 있어 각 테스트마다 자동 초기화됨

vi.mock('@/lib/prisma', () => ({
  prisma: {
    song: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    lyricLine: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    songLyricsRaw: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

describe('determineLyricsAction', () => {
  it('DONE 상태면 serve_cached를 반환한다', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: 'song-1',
      genius_id: '123',
      genius_path: '/test',
      lyrics_status: 'DONE',
      locked_at: null,
      generation_id: 'gen-1',
    } as any)

    vi.mocked(prisma.lyricLine.findMany).mockResolvedValue([
      {
        line_number: 1,
        original: 'Hello',
        translation: '안녕',
        slang: null,
        explanation: null,
        generation_id: 'gen-1',
      },
    ] as any)

    const { determineLyricsAction } = await import('@/app/api/songs/[id]/lyrics/route')
    const action = await determineLyricsAction('song-1')
    expect(action.type).toBe('serve_cached')
  })

  it('PROCESSING이고 최근이면 processing을 반환한다', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.song.findUnique).mockResolvedValue({
      id: 'song-1',
      lyrics_status: 'PROCESSING',
      locked_at: new Date(), // 방금 잠김
    } as any)

    const { determineLyricsAction } = await import('@/app/api/songs/[id]/lyrics/route')
    const action = await determineLyricsAction('song-1')
    expect(action.type).toBe('processing')
  })
})
```

- [ ] **Step 2: 테스트 FAIL 확인**

```bash
npm run test:run -- __tests__/api/songs-lyrics.test.ts
```

- [ ] **Step 3: 가사 API 구현**

```ts
// app/api/songs/[id]/lyrics/route.ts

/**
 * @swagger
 * /api/songs/{id}/lyrics:
 *   get:
 *     summary: 가사 + 번역 + 해석 스트리밍 (NDJSON)
 *     tags: [Songs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: NDJSON 스트림 (각 줄이 LyricLine JSON)
 *         content:
 *           application/x-ndjson:
 *             schema:
 *               type: string
 *       202:
 *         description: 다른 프로세스가 처리 중 — 클라이언트 재시도 필요
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Song } from '@prisma/client'
import { scrapeLyrics } from '@/lib/scraper'
import { getReferents } from '@/lib/genius'
import { streamLyricInterpretations } from '@/lib/gpt'
import { randomUUID } from 'crypto'
import type { LyricLineData } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STALE_LOCK_MS = 5 * 60 * 1000

type LyricsAction =
  | { type: 'serve_cached'; lines: LyricLineData[] }
  | { type: 'processing' }
  | { type: 'generate'; song: Song; generationId: string }

export async function determineLyricsAction(songId: string): Promise<LyricsAction> {
  const song = await prisma.song.findUnique({ where: { id: songId } })
  if (!song) throw new Error('Song not found')

  if (song.lyrics_status === 'DONE') {
    const lines = await prisma.lyricLine.findMany({
      where: { song_id: songId },
      orderBy: { line_number: 'asc' },
      select: {
        line_number: true,
        original: true,
        translation: true,
        slang: true,
        explanation: true,
      },
    })
    return { type: 'serve_cached', lines }
  }

  const isStale =
    song.lyrics_status === 'PROCESSING' &&
    song.locked_at != null &&
    Date.now() - song.locked_at.getTime() > STALE_LOCK_MS

  if (song.lyrics_status === 'PROCESSING' && !isStale) {
    return { type: 'processing' }
  }

  // Atomic lock: NONE, FAILED, 또는 stale PROCESSING
  const generationId = randomUUID()
  const staleThreshold = new Date(Date.now() - STALE_LOCK_MS)

  const { count } = await prisma.song.updateMany({
    where: {
      id: songId,
      OR: [
        { lyrics_status: 'NONE' },
        { lyrics_status: 'FAILED' },
        { lyrics_status: 'PROCESSING', locked_at: { lt: staleThreshold } },
      ],
    },
    data: { lyrics_status: 'PROCESSING', locked_at: new Date(), generation_id: generationId },
  })

  if (count === 0) return { type: 'processing' }
  return { type: 'generate', song, generationId }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let action: LyricsAction
  try {
    action = await determineLyricsAction(id)
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (action.type === 'processing') {
    return Response.json({ status: 'processing' }, { status: 202 })
  }

  const encoder = new TextEncoder()

  // DONE → 동일한 NDJSON 형식으로 즉시 스트리밍
  if (action.type === 'serve_cached') {
    const stream = new ReadableStream({
      start(controller) {
        for (const line of action.lines) {
          controller.enqueue(
            encoder.encode(JSON.stringify({
              line: line.line_number,
              original: line.original,
              translation: line.translation,
              slang: line.slang,
              explanation: line.explanation,
            }) + '\n')
          )
        }
        controller.close()
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson' },
    })
  }

  // 신규 생성 스트리밍
  const { song, generationId } = action

  const stream = new ReadableStream({
    async start(controller) {
      const buffer: LyricLineData[] = []

      const flushBuffer = async () => {
        if (buffer.length === 0) return
        await prisma.lyricLine.createMany({
          data: buffer.map((line) => ({
            song_id: id,
            line_number: line.line_number,
            original: line.original,
            translation: line.translation,
            slang: line.slang,
            explanation: line.explanation,
            generation_id: generationId,
          })),
          skipDuplicates: true,
        })
        buffer.length = 0
      }

      try {
        await prisma.lyricLine.deleteMany({ where: { song_id: id } })

        // 가사 스크래핑 (캐시 우선)
        const cachedRaw = await prisma.songLyricsRaw.findUnique({
          where: { song_id: id },
        })
        let rawLyrics: string
        if (cachedRaw) {
          rawLyrics = cachedRaw.raw_text
        } else {
          rawLyrics = await scrapeLyrics(song.genius_path)
          await prisma.songLyricsRaw.create({
            data: { song_id: id, raw_text: rawLyrics },
          })
        }

        const referentsContext = await getReferents(song.genius_id)

        for await (const line of streamLyricInterpretations(rawLyrics, referentsContext)) {
          controller.enqueue(
            encoder.encode(JSON.stringify({
              line: line.line_number,
              original: line.original,
              translation: line.translation,
              slang: line.slang,
              explanation: line.explanation,
            }) + '\n')
          )
          buffer.push(line)
          if (buffer.length >= 10) await flushBuffer()
        }

        await flushBuffer()
        await prisma.song.update({
          where: { id },
          data: { lyrics_status: 'DONE' },
        })
      } catch (error) {
        console.error('Lyrics generation error:', error)
        await prisma.lyricLine.deleteMany({ where: { song_id: id } })
        await prisma.song.update({
          where: { id },
          data: { lyrics_status: 'FAILED' },
        })
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: 'Generation failed' }) + '\n')
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- __tests__/api/songs-lyrics.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add "app/api/songs/[id]/lyrics" __tests__/api/
git commit -m "feat: lyrics generation API with atomic lock and NDJSON streaming"
```

---

## Task 11: Swagger API 문서

**Files:**
- Create: `app/api/docs/route.ts`
- Create: `app/(main)/docs/page.tsx`

- [ ] **Step 1: Swagger JSON 엔드포인트**

```ts
// app/api/docs/route.ts
import { createSwaggerSpec } from 'next-swagger-doc'

export const dynamic = 'force-dynamic'

export async function GET() {
  const spec = createSwaggerSpec({
    apiFolder: 'app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Under-Line API',
        version: '1.0.0',
        description: '가사 해석 서비스 API',
      },
      tags: [
        { name: 'Songs', description: '곡 검색, 메타데이터, 가사 해석' },
        { name: 'Auth', description: '인증' },
        { name: 'Spotify', description: 'Spotify 연동' },
      ],
    },
  })

  return Response.json(spec)
}
```

- [ ] **Step 2: Swagger UI 페이지**

```tsx
// app/(main)/docs/page.tsx
'use client'

import { useEffect, useState } from 'react'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function DocsPage() {
  const [spec, setSpec] = useState(null)

  useEffect(() => {
    fetch('/api/docs').then((r) => r.json()).then(setSpec)
  }, [])

  if (!spec) return <div className="p-8 text-zinc-400">Loading API docs...</div>

  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI spec={spec} />
    </div>
  )
}
```

- [ ] **Step 3: 수동 테스트**

```bash
# http://localhost:3000/docs 접속
# Swagger UI에서 GET /api/songs/search, GET /api/songs/{id}/lyrics 등 확인
```

- [ ] **Step 4: 커밋**

```bash
git add "app/api/docs" "app/(main)/docs"
git commit -m "feat: Swagger API documentation"
```

---

## Task 12: 검색바 컴포넌트

**Files:**
- Create: `components/search/SearchBar.tsx`

- [ ] **Step 1: 구현**

```tsx
// components/search/SearchBar.tsx
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
```

- [ ] **Step 2: 커밋**

```bash
git add components/search/
git commit -m "feat: search bar with debounce"
```

---

## Task 13: 가사 UI 컴포넌트

**Files:**
- Create: `components/lyrics/LyricLine.tsx`
- Create: `components/lyrics/InterpretationPanel.tsx`
- Create: `components/lyrics/LyricsView.tsx`

- [ ] **Step 1: 단일 줄 컴포넌트**

```tsx
// components/lyrics/LyricLine.tsx
'use client'

import type { LyricLineData } from '@/types'

interface Props {
  line: LyricLineData
  isSelected: boolean
  onClick: () => void
}

export function LyricLine({ line, isSelected, onClick }: Props) {
  const isSection = /^\[.+\]$/.test(line.original.trim())

  if (isSection) {
    return (
      <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-widest text-zinc-400">
        {line.original}
      </div>
    )
  }

  const hasInterpretation = !!(line.slang || line.explanation)

  return (
    <div
      onClick={hasInterpretation ? onClick : undefined}
      className={`group py-1 ${hasInterpretation ? 'cursor-pointer' : ''}`}
    >
      <p
        className={[
          'text-base leading-relaxed transition-colors',
          hasInterpretation ? 'group-hover:text-zinc-500' : '',
          isSelected ? 'font-medium' : 'text-zinc-900 dark:text-zinc-100',
        ].join(' ')}
      >
        {line.original}
        {hasInterpretation && (
          <span className="ml-1 text-xs text-zinc-300 dark:text-zinc-600">•</span>
        )}
      </p>
      {line.translation && (
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {line.translation}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 해석 패널**

```tsx
// components/lyrics/InterpretationPanel.tsx
'use client'

import type { LyricLineData } from '@/types'

interface Props {
  line: LyricLineData | null
  onClose?: () => void
  mode: 'panel' | 'modal'
}

export function InterpretationPanel({ line, onClose, mode }: Props) {
  const content = line ? (
    <div className="space-y-4 p-6">
      <p className="text-lg font-medium leading-relaxed">{line.original}</p>
      {line.translation && (
        <p className="text-zinc-500 dark:text-zinc-400">{line.translation}</p>
      )}
      {line.slang && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            슬랭
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-200">{line.slang}</p>
        </div>
      )}
      {line.explanation && (
        <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800">
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {line.explanation}
          </p>
        </div>
      )}
    </div>
  ) : (
    mode === 'panel' ? (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        줄을 클릭하면 해석이 나타납니다
      </div>
    ) : null
  )

  if (mode === 'modal') {
    if (!line) return null
    return (
      <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
        <div
          className="max-h-[70vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-end p-2">
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600">✕</button>
          </div>
          {content}
        </div>
      </div>
    )
  }

  return <div className="h-full overflow-y-auto">{content}</div>
}
```

- [ ] **Step 3: 가사 뷰 (스트리밍 포함)**

```tsx
// components/lyrics/LyricsView.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { LyricLine } from './LyricLine'
import { InterpretationPanel } from './InterpretationPanel'
import type { LyricLineData } from '@/types'

type Status = 'loading' | 'processing' | 'streaming' | 'done' | 'error'

export function LyricsView({ songId }: { songId: string }) {
  const [lines, setLines] = useState<LyricLineData[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [selectedLine, setSelectedLine] = useState<LyricLineData | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadLyrics = useCallback(async () => {
    setStatus('loading')
    setLines([])

    const res = await fetch(`/api/songs/${songId}/lyrics`)

    if (res.status === 202) {
      setStatus('processing')
      setTimeout(loadLyrics, 3000)
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
            setLines((prev) => [...prev, {
              line_number: obj.line,
              original: obj.original,
              translation: obj.translation,
              slang: obj.slang,
              explanation: obj.explanation,
            }])
          } catch { /* 파싱 실패 줄 무시 */ }
        }
      }
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }, [songId])

  useEffect(() => { loadLyrics() }, [loadLyrics])

  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-zinc-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        <p className="text-sm">다른 사용자가 이 곡을 처리 중입니다. 잠시 후 자동으로 업데이트됩니다.</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-zinc-500">
        <p>가사를 불러오는 데 실패했습니다.</p>
        <button
          onClick={loadLyrics}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full gap-8">
        <div className={`overflow-y-auto ${isMobile ? 'w-full' : 'w-3/5'}`}>
          {status === 'loading' && (
            <div className="space-y-3 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
          )}
          <div className="space-y-0.5 py-4">
            {lines.map((line) => (
              <LyricLine
                key={line.line_number}
                line={line}
                isSelected={selectedLine?.line_number === line.line_number}
                onClick={() => setSelectedLine(line)}
              />
            ))}
          </div>
        </div>

        {!isMobile && (
          <div className="w-2/5 border-l border-zinc-100 dark:border-zinc-800">
            <InterpretationPanel line={selectedLine} mode="panel" />
          </div>
        )}
      </div>

      {isMobile && (
        <InterpretationPanel
          line={selectedLine}
          mode="modal"
          onClose={() => setSelectedLine(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add components/lyrics/
git commit -m "feat: lyrics UI components"
```

---

## Task 14: 페이지 조립

**Files:**
- Modify: `app/layout.tsx`
- Create: `app/(main)/layout.tsx`
- Create: `app/(main)/page.tsx`
- Create: `app/(main)/songs/[id]/page.tsx`

- [ ] **Step 1: 루트 레이아웃**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Under-Line — 가사의 숨겨진 의미',
  description: '가사 한 줄 한 줄의 진짜 의미를 찾아보세요',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 메인 레이아웃**

```tsx
// app/(main)/layout.tsx
import Link from 'next/link'
import { auth } from '@/lib/auth'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          under<span className="text-zinc-400">_</span>line
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/docs" className="text-zinc-400 hover:text-zinc-600">API 문서</Link>
          {session ? (
            <Link href="/profile" className="flex items-center gap-2">
              {session.user?.image && (
                <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" />
              )}
            </Link>
          ) : (
            <Link href="/login" className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-white dark:text-zinc-900">
              로그인
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: 홈 페이지**

```tsx
// app/(main)/page.tsx
import { SearchBar } from '@/components/search/SearchBar'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-12 py-20">
      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">가사의 숨겨진 의미</h1>
        <p className="text-lg text-zinc-500">한 줄 한 줄, 진짜 의미를 찾아보세요</p>
      </div>
      <SearchBar />
    </div>
  )
}
```

- [ ] **Step 4: 가사 페이지**

```tsx
// app/(main)/songs/[id]/page.tsx
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { LyricsView } from '@/components/lyrics/LyricsView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SongPage({ params }: Props) {
  const { id } = await params
  const song = await prisma.song.findUnique({ where: { id } })
  if (!song) notFound()

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-4">
        {song.image_url && (
          <img src={song.image_url} alt="" className="h-16 w-16 rounded-lg object-cover shadow" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{song.title}</h1>
          <p className="text-zinc-500">{song.artist}</p>
        </div>
      </div>
      <div className="flex-1">
        <LyricsView songId={song.id} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 전체 흐름 수동 테스트**

```
1. npm run dev
2. http://localhost:3000 접속
3. "kendrick lamar not like us" 검색
4. 결과 클릭 → /songs/{id} 이동
5. 가사가 위에서 아래로 줄별로 스트리밍되며 채워짐 확인
6. 해석 있는 줄(• 표시) 클릭 → PC: 우측 패널 / 모바일: 하단 모달
7. 한국어 곡 검색 → translation 줄 없이 표시 확인
8. 같은 곡 새로고침 → 즉시 로드 (스트리밍 없음)
9. http://localhost:3000/docs → Swagger UI 확인
```

- [ ] **Step 6: 전체 테스트 실행**

```bash
npm run test:run
```
Expected: 모든 테스트 PASS

- [ ] **Step 7: 최종 커밋**

```bash
git add app/ components/
git commit -m "feat: home page, song page, and navigation"
```

---

## Task 15: Rate Limiting (미들웨어)

**Files:**
- Create: `middleware.ts`
- Create: `lib/rate-limit.ts`

> GPT + 스크래핑 호출 1회당 $0.03~0.08. IP 기반 슬라이딩 윈도우로 요금 폭탄 방지.

- [ ] **Step 1: Rate Limiter 유틸 작성**

```ts
// lib/rate-limit.ts

interface RateLimitEntry {
  count: number
  resetAt: number
}

// 인메모리 저장소 (싱글 서버 환경에 적합 — 미니 PC 배포 기준)
const store = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
  limit: number      // 허용 요청 수
  windowMs: number   // 시간 창 (ms)
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // 새 창 시작
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.limit - 1, resetAt }
  }

  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt }
}
```

- [ ] **Step 2: 미들웨어 작성**

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

// 엔드포인트별 제한 설정
const LIMITS: Record<string, { limit: number; windowMs: number }> = {
  '/api/songs/search':    { limit: 30,  windowMs: 60_000  }, // 분당 30회
  '/api/songs/[id]/lyrics': { limit: 5, windowMs: 60_000  }, // 분당 5회 (GPT 호출)
  default:                { limit: 60,  windowMs: 60_000  }, // 기타 API
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API 라우트에만 적용
  if (!pathname.startsWith('/api/')) return NextResponse.next()
  // Auth 라우트 제외
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()

  // IP 추출 (프록시 뒤에 있을 경우 X-Forwarded-For 우선)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  // 라우트 매칭
  const configKey = pathname.includes('/lyrics')
    ? '/api/songs/[id]/lyrics'
    : pathname.startsWith('/api/songs/search')
    ? '/api/songs/search'
    : 'default'

  const config = LIMITS[configKey]
  const key = `${ip}:${configKey}`
  const { allowed, remaining, resetAt } = checkRateLimit(key, config)

  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please slow down.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(config.limit))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  return response
}

export const config = {
  matcher: '/api/:path*',
}
```

- [ ] **Step 3: 수동 테스트**

```bash
# 가사 API를 빠르게 6번 호출 (5회 제한)
for i in {1..6}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    "http://localhost:3000/api/songs/{VALID_SONG_ID}/lyrics"
done
```
Expected: 처음 5번 200/202, 6번째 429

- [ ] **Step 4: 커밋**

```bash
git add middleware.ts lib/rate-limit.ts
git commit -m "feat: IP-based rate limiting for API routes"
```

---

---

## Task 16: 에러 헬퍼 + 로깅 + 헬스체크 + Auth Guard

**Files:**
- Create: `lib/api-error.ts`
- Create: `lib/logger.ts`
- Create: `app/api/health/route.ts`
- Create: `lib/auth-guard.ts`

- [ ] **Step 1: 테스트 작성**

```ts
// __tests__/lib/api-error.test.ts
import { apiError } from '@/lib/api-error'

test('apiError shapes response correctly', () => {
  const result = apiError('/api/test', 404, 'SONG_NOT_FOUND')
  expect(result).toMatchObject({
    path: '/api/test',
    status: 404,
    code: 'SONG_NOT_FOUND',
    message: 'SONG_NOT_FOUND',
    details: null,
  })
  expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
})

test('apiError accepts custom message and details', () => {
  const result = apiError('/api/test', 400, 'BAD_REQUEST', 'q is required', { field: 'q' })
  expect(result.message).toBe('q is required')
  expect(result.details).toEqual({ field: 'q' })
})
```

Run: `npx vitest run __tests__/lib/api-error.test.ts`
Expected: FAIL (api-error.ts not yet created)

- [ ] **Step 2: `lib/api-error.ts` 구현**

```ts
// lib/api-error.ts
import type { ErrorCode, ApiErrorResponse } from '@/types'

export function apiError(
  path: string,
  status: number,
  code: ErrorCode,
  message?: string,
  details?: unknown
): ApiErrorResponse {
  return {
    timestamp: new Date().toISOString(),
    path,
    status,
    code,
    message: message ?? code,
    details: details ?? null,
  }
}
```

Run: `npx vitest run __tests__/lib/api-error.test.ts`
Expected: PASS

- [ ] **Step 3: `lib/logger.ts` 구현**

```ts
// lib/logger.ts
export interface RequestLog {
  method: string
  path: string
  status: number
  latency: number
  userId?: string
}

export function logRequest({ method, path, status, latency, userId }: RequestLog) {
  const ts = new Date().toISOString()
  const user = userId ? ` uid=${userId}` : ''
  console.log(`[${ts}] ${method} ${path} ${status} ${latency}ms${user}`)
}
```

- [ ] **Step 4: `middleware.ts`에 로깅 추가**

기존 `middleware.ts` rate-limit 로직 앞에 로깅 훅 추가:

```ts
// middleware.ts 상단에 추가
import { logRequest } from '@/lib/logger'

// export default middleware 함수 내부, NextResponse.next() 반환 직전:
const start = Date.now()
// ... 기존 rate-limit 로직 ...
// NextResponse.next() 반환 전에:
logRequest({ method: req.method, path: req.nextUrl.pathname, status: 200, latency: Date.now() - start })
```

> 참고: middleware에서는 응답 status를 확인하기 어려우므로 rate-limit 통과 시 200으로 기록. 실제 handler status는 handler 내부에서 별도 로깅 가능.

- [ ] **Step 5: `app/api/health/route.ts` 구현**

```ts
// app/api/health/route.ts
import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.0.1',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? 'dev',
  })
}
```

수동 테스트: `curl http://localhost:3000/api/health`
Expected: `{"status":"ok","version":"...","buildTime":"dev"}`

- [ ] **Step 6: `lib/auth-guard.ts` 구현**

```ts
// lib/auth-guard.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-error'

export async function requireAuth(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      apiError(req.nextUrl.pathname, 401, 'UNAUTHORIZED'),
      { status: 401 }
    )
  }
  return null
}

export async function requireAdmin(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      apiError(req.nextUrl.pathname, 401, 'UNAUTHORIZED'),
      { status: 401 }
    )
  }
  if (session.user.role !== 'ROLE_ADMIN') {
    return NextResponse.json(
      apiError(req.nextUrl.pathname, 403, 'FORBIDDEN'),
      { status: 403 }
    )
  }
  return null
}
```

- [ ] **Step 7: 커밋**

```bash
git add lib/api-error.ts lib/logger.ts lib/auth-guard.ts \
  app/api/health/route.ts middleware.ts \
  __tests__/lib/api-error.test.ts
git commit -m "feat: error helper, request logging, health endpoint, auth guard"
```

---

## Task 17: Admin API (RBAC 보호)

**Files:**
- Create: `app/api/admin/songs/route.ts`
- Create: `app/api/admin/songs/[id]/route.ts`
- Create: `app/api/admin/songs/[id]/reset/route.ts`

- [ ] **Step 1: 테스트 작성**

```ts
// __tests__/api/admin-songs.test.ts
import { GET } from '@/app/api/admin/songs/route'
import { NextRequest } from 'next/server'
import { vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { song: { findMany: vi.fn(), count: vi.fn() } } }))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

test('admin songs returns 401 when not logged in', async () => {
  vi.mocked(auth).mockResolvedValue(null)
  const req = new NextRequest('http://localhost/api/admin/songs')
  const res = await GET(req)
  expect(res.status).toBe(401)
})

test('admin songs returns 403 for ROLE_USER', async () => {
  vi.mocked(auth).mockResolvedValue({ user: { id: '1', role: 'ROLE_USER' } } as never)
  const req = new NextRequest('http://localhost/api/admin/songs')
  const res = await GET(req)
  expect(res.status).toBe(403)
})

test('admin songs returns paginated list for ROLE_ADMIN', async () => {
  vi.mocked(auth).mockResolvedValue({ user: { id: '1', role: 'ROLE_ADMIN' } } as never)
  vi.mocked(prisma.song.findMany).mockResolvedValue([])
  vi.mocked(prisma.song.count).mockResolvedValue(0)
  const req = new NextRequest('http://localhost/api/admin/songs?page=1&size=20')
  const res = await GET(req)
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body).toHaveProperty('pagination')
  expect(body.pagination.page).toBe(1)
})
```

Run: `npx vitest run __tests__/api/admin-songs.test.ts`
Expected: FAIL

- [ ] **Step 2: `app/api/admin/songs/route.ts`**

```ts
// app/api/admin/songs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'
import type { PaginatedResponse } from '@/types'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const url = req.nextUrl
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? 20)))
  const skip = (page - 1) * size

  const [songs, total] = await Promise.all([
    prisma.song.findMany({
      skip,
      take: size,
      orderBy: { created_at: 'desc' },
      select: {
        id: true, genius_id: true, title: true, artist: true,
        image_url: true, lyrics_status: true, created_at: true,
      },
    }),
    prisma.song.count(),
  ])

  const body: PaginatedResponse<typeof songs[0]> = {
    data: songs,
    pagination: { page, size, total, totalPages: Math.ceil(total / size) },
  }
  return NextResponse.json(body)
}
```

- [ ] **Step 3: `app/api/admin/songs/[id]/route.ts`** (DELETE)

```ts
// app/api/admin/songs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const { id } = await params
  const song = await prisma.song.findUnique({ where: { id } })
  if (!song) {
    return NextResponse.json(
      apiError(req.nextUrl.pathname, 404, 'SONG_NOT_FOUND'),
      { status: 404 }
    )
  }

  await prisma.song.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: `app/api/admin/songs/[id]/reset/route.ts`** (강제 재생성)

```ts
// app/api/admin/songs/[id]/reset/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const { id } = await params
  const song = await prisma.song.findUnique({ where: { id } })
  if (!song) {
    return NextResponse.json(
      apiError(req.nextUrl.pathname, 404, 'SONG_NOT_FOUND'),
      { status: 404 }
    )
  }

  await prisma.song.update({
    where: { id },
    data: { lyrics_status: 'NONE', locked_at: null, generation_id: null },
  })

  return NextResponse.json({ message: 'reset' })
}
```

Run: `npx vitest run __tests__/api/admin-songs.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: 커밋**

```bash
git add app/api/admin/ __tests__/api/admin-songs.test.ts
git commit -m "feat: admin API endpoints with RBAC guard"
```

---

## Plan A 완료 체크리스트

- [ ] Google/Spotify OAuth 로그인 동작
- [ ] 검색 + debounce 정상 동작
- [ ] 첫 조회: NDJSON 스트리밍으로 줄 채워짐
- [ ] 재조회: DB에서 즉시 로드
- [ ] 줄 클릭 → PC 우측 패널 / 모바일 하단 모달
- [ ] 한국어 곡: translation null, 번역 줄 미표시
- [ ] Swagger UI `/docs` 접속 가능
- [ ] 모든 단위 테스트 PASS
- [ ] Rate Limit: 가사 API 6번째 호출 시 429 반환
- [ ] `GET /api/health` 200 반환
- [ ] 미인증 `/api/admin/*` → 401, ROLE_USER → 403
- [ ] `GET /api/admin/songs` 페이지네이션 응답 확인

**다음 단계:** Plan B — Spotify Now Playing / Liked Songs / 홈 분기 UI / 프로필 / Nginx + Docker
