# Under-Line Plan B: Spotify + Home UI + Profile + Docker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spotify Now Playing / Liked Songs 연동, 로그인 상태별 홈 화면 분기, 계정 연동 프로필 페이지, Nginx + Docker 배포까지 완성

**Architecture:** Plan A 위에 빌드. Spotify 토큰은 Account 테이블에서 읽고, 만료 시 자동 갱신 후 재시도. 홈은 서버 컴포넌트에서 세션 확인 후 클라이언트 컴포넌트에 분기.

**Tech Stack:** Plan A 스택 + Spotify Web API, Docker, Nginx

**Spec:** `docs/superpowers/specs/2026-03-23-under-line-design.md`
**Plan A:** `docs/superpowers/plans/2026-03-24-plan-a-foundation-and-lyrics.md`

---

## File Map

```
lib/
└── spotify.ts                             ← Spotify API 클라이언트 + 토큰 갱신

app/
├── api/
│   └── spotify/
│       ├── now-playing/route.ts           ← GET 현재 재생 곡
│       └── liked-songs/route.ts           ← GET Liked Songs 목록
└── (main)/
    ├── page.tsx                           ← 수정: 상태별 홈 분기
    └── profile/page.tsx                   ← 계정 연동 페이지

components/
├── home/
│   ├── SpotifyHome.tsx                    ← Spotify 연동 상태 홈
│   └── DefaultHome.tsx                    ← 비로그인 / Google 전용 홈
└── profile/
    └── AccountLinks.tsx                   ← 연동된 계정 목록 + 연동 버튼

nginx/
└── nginx.conf                             ← 스트리밍 버퍼링 OFF 설정

Dockerfile
docker-compose.yml
.dockerignore

__tests__/
└── lib/spotify.test.ts                    ← 토큰 갱신 로직 단위 테스트
```

---

## Task 1: Spotify API 클라이언트 + 토큰 갱신

**Files:**
- Create: `lib/spotify.ts`
- Create: `__tests__/lib/spotify.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// __tests__/lib/spotify.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

global.fetch = vi.fn()

describe('getSpotifyToken', () => {
  it('유효한 토큰이 있으면 그대로 반환한다', async () => {
    const { prisma } = await import('@/lib/prisma')
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600 // 1시간 후

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      access_token: 'valid-token',
      refresh_token: 'refresh-token',
      expires_at: futureExpiry,
    } as any)

    const { getSpotifyToken } = await import('@/lib/spotify')
    const token = await getSpotifyToken('user-1')
    expect(token).toBe('valid-token')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('토큰이 만료됐으면 refresh_token으로 갱신한다', async () => {
    const { prisma } = await import('@/lib/prisma')
    const pastExpiry = Math.floor(Date.now() / 1000) - 60 // 1분 전 만료

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      access_token: 'expired-token',
      refresh_token: 'my-refresh-token',
      expires_at: pastExpiry,
    } as any)

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-token',
        expires_in: 3600,
      }),
    } as Response)

    vi.mocked(prisma.account.update).mockResolvedValue({} as any)

    const { getSpotifyToken } = await import('@/lib/spotify')
    const token = await getSpotifyToken('user-1')
    expect(token).toBe('new-token')
    expect(prisma.account.update).toHaveBeenCalledOnce()
  })

  it('Spotify 계정이 없으면 null을 반환한다', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.account.findFirst).mockResolvedValue(null)

    const { getSpotifyToken } = await import('@/lib/spotify')
    const token = await getSpotifyToken('user-1')
    expect(token).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 FAIL 확인**

```bash
npm run test:run -- __tests__/lib/spotify.test.ts
```
Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// lib/spotify.ts
import { prisma } from '@/lib/prisma'

const SPOTIFY_API = 'https://api.spotify.com/v1'

// Spotify access token 조회 + 만료 시 자동 갱신
export async function getSpotifyToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'spotify' },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  })

  if (!account) return null
  if (!account.access_token) return null

  // expires_at은 Unix timestamp (초 단위)
  const nowSec = Math.floor(Date.now() / 1000)
  const isExpired = account.expires_at != null && account.expires_at < nowSec + 60

  if (!isExpired) return account.access_token

  // 토큰 갱신
  if (!account.refresh_token) return null

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    }),
  })

  if (!res.ok) {
    console.error('Spotify token refresh failed:', res.status)
    return null
  }

  const data = await res.json()
  const newExpiresAt = Math.floor(Date.now() / 1000) + data.expires_in

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: newExpiresAt,
    },
  })

  return data.access_token
}

// Spotify API 호출 헬퍼
async function spotifyFetch(userId: string, path: string) {
  const token = await getSpotifyToken(userId)
  if (!token) throw new SpotifyAuthError('No Spotify account linked')

  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) throw new SpotifyAuthError('Token invalid')
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`)

  // 204 No Content (재생 중인 곡 없음 등)
  if (res.status === 204) return null

  return res.json()
}

export class SpotifyAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpotifyAuthError'
  }
}

// 현재 재생 중인 곡
export async function getNowPlaying(userId: string) {
  const data = await spotifyFetch(userId, '/me/player/currently-playing')
  if (!data || !data.item) return null

  return {
    title: data.item.name as string,
    artist: (data.item.artists as Array<{ name: string }>)
      .map((a) => a.name)
      .join(', '),
    album_image: (data.item.album.images[0]?.url ?? null) as string | null,
    is_playing: data.is_playing as boolean,
    progress_ms: data.progress_ms as number,
    duration_ms: data.item.duration_ms as number,
  }
}

// Liked Songs 목록 (최근 50곡)
export async function getLikedSongs(userId: string) {
  const data = await spotifyFetch(userId, '/me/tracks?limit=50')
  if (!data) return []

  return (data.items as Array<{
    track: {
      name: string
      artists: Array<{ name: string }>
      album: { images: Array<{ url: string }> }
    }
  }>).map((item) => ({
    title: item.track.name,
    artist: item.track.artists.map((a) => a.name).join(', '),
    album_image: item.track.album.images[0]?.url ?? null,
  }))
}
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm run test:run -- __tests__/lib/spotify.test.ts
```

- [ ] **Step 5: 커밋**

```bash
git add lib/spotify.ts __tests__/lib/spotify.test.ts
git commit -m "feat: Spotify API client with token auto-refresh"
```

---

## Task 2: Spotify Now Playing API

**Files:**
- Create: `app/api/spotify/now-playing/route.ts`

- [ ] **Step 1: 구현**

```ts
// app/api/spotify/now-playing/route.ts

/**
 * @swagger
 * /api/spotify/now-playing:
 *   get:
 *     summary: 현재 Spotify에서 재생 중인 곡
 *     tags: [Spotify]
 *     responses:
 *       200:
 *         description: 재생 중인 곡 정보 (없으면 null)
 *       401:
 *         description: Spotify 계정 미연동
 */
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getNowPlaying, SpotifyAuthError } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const track = await getNowPlaying(session.user.id)
    return Response.json({ track })
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return Response.json({ error: 'Spotify not linked', code: 'NOT_LINKED' }, { status: 401 })
    }
    console.error('Now playing error:', error)
    return Response.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 수동 테스트**

```bash
# Spotify 로그인 후
curl -H "Cookie: ..." http://localhost:3000/api/spotify/now-playing
```
Expected: `{"track":{"title":"...","artist":"...","is_playing":true}}` 또는 `{"track":null}`

- [ ] **Step 3: 커밋**

```bash
git add "app/api/spotify/now-playing"
git commit -m "feat: Spotify now-playing API"
```

---

## Task 3: Spotify Liked Songs API

**Files:**
- Create: `app/api/spotify/liked-songs/route.ts`

- [ ] **Step 1: 구현**

```ts
// app/api/spotify/liked-songs/route.ts

/**
 * @swagger
 * /api/spotify/liked-songs:
 *   get:
 *     summary: Spotify Liked Songs 목록 (최근 50곡)
 *     tags: [Spotify]
 *     responses:
 *       200:
 *         description: 곡 목록
 *       401:
 *         description: Spotify 계정 미연동
 */
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getLikedSongs, SpotifyAuthError } from '@/lib/spotify'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const songs = await getLikedSongs(session.user.id)
    return Response.json({ songs })
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return Response.json({ error: 'Spotify not linked', code: 'NOT_LINKED' }, { status: 401 })
    }
    console.error('Liked songs error:', error)
    return Response.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add "app/api/spotify/liked-songs"
git commit -m "feat: Spotify liked-songs API"
```

---

## Task 4: 홈 화면 컴포넌트 (상태별 분기)

**Files:**
- Create: `components/home/SpotifyHome.tsx`
- Create: `components/home/DefaultHome.tsx`

- [ ] **Step 1: Spotify 연동 상태 홈**

```tsx
// components/home/SpotifyHome.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SearchBar } from '@/components/search/SearchBar'

interface NowPlayingTrack {
  title: string
  artist: string
  album_image: string | null
  is_playing: boolean
}

interface LikedSong {
  title: string
  artist: string
  album_image: string | null
}

export function SpotifyHome() {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingTrack | null>(null)
  const [likedSongs, setLikedSongs] = useState<LikedSong[]>([])
  const [loadingNow, setLoadingNow] = useState(true)
  const [loadingLiked, setLoadingLiked] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // 현재 재생 곡
    fetch('/api/spotify/now-playing')
      .then((r) => r.json())
      .then((d) => setNowPlaying(d.track))
      .finally(() => setLoadingNow(false))

    // Liked Songs
    fetch('/api/spotify/liked-songs')
      .then((r) => r.json())
      .then((d) => setLikedSongs(d.songs ?? []))
      .finally(() => setLoadingLiked(false))
  }, [])

  const handleNowPlayingClick = async () => {
    if (!nowPlaying) return
    // 곡명 + 아티스트로 Genius 검색 → 첫 번째 결과 자동 선택
    const q = `${nowPlaying.title} ${nowPlaying.artist}`
    const res = await fetch(`/api/songs/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    const first = data.results?.[0]
    if (!first) return

    // upsert 후 이동
    const upsertRes = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(first),
    })
    const { id } = await upsertRes.json()
    router.push(`/songs/${id}`)
  }

  const handleLikedSongClick = async (song: LikedSong) => {
    const q = `${song.title} ${song.artist}`
    const res = await fetch(`/api/songs/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    const first = data.results?.[0]
    if (!first) return

    const upsertRes = await fetch('/api/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(first),
    })
    const { id } = await upsertRes.json()
    router.push(`/songs/${id}`)
  }

  return (
    <div className="flex flex-col gap-10">
      {/* 현재 재생 중인 곡 */}
      <section>
        {loadingNow ? (
          <div className="h-20 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        ) : nowPlaying ? (
          <button
            onClick={handleNowPlayingClick}
            className="flex w-full items-center gap-4 rounded-2xl bg-green-500 p-5 text-left text-white shadow-lg transition hover:bg-green-600"
          >
            {nowPlaying.album_image && (
              <img src={nowPlaying.album_image} alt="" className="h-14 w-14 rounded-lg shadow" />
            )}
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {nowPlaying.is_playing ? '▶ 지금 듣는 중' : '⏸ 일시정지'}
              </p>
              <p className="text-lg font-bold">{nowPlaying.title}</p>
              <p className="opacity-80">{nowPlaying.artist}</p>
            </div>
            <span className="text-2xl">→</span>
          </button>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-5 text-center text-zinc-400 dark:border-zinc-700">
            현재 재생 중인 곡이 없습니다
          </div>
        )}
      </section>

      {/* Liked Songs 갤러리 */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          ❤️ Liked Songs
        </h2>
        {loadingLiked ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
            {likedSongs.map((song, i) => (
              <button
                key={i}
                onClick={() => handleLikedSongClick(song)}
                title={`${song.title} — ${song.artist}`}
                className="group relative aspect-square overflow-hidden rounded-lg"
              >
                {song.album_image ? (
                  <img
                    src={song.album_image}
                    alt={song.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-200 text-xs text-zinc-400 dark:bg-zinc-700">
                    ♪
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                  <p className="truncate text-xs font-medium text-white">{song.title}</p>
                  <p className="truncate text-xs text-white/70">{song.artist}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 검색창 */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          🔍 직접 검색
        </h2>
        <SearchBar />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: 기본 홈 (비로그인 / Google 전용)**

```tsx
// components/home/DefaultHome.tsx
import { SearchBar } from '@/components/search/SearchBar'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

async function getRecentSongs() {
  return prisma.song.findMany({
    where: { lyrics_status: 'DONE' },
    orderBy: { created_at: 'desc' },
    take: 12,
    select: { id: true, title: true, artist: true, image_url: true },
  })
}

export async function DefaultHome({ hasSession }: { hasSession: boolean }) {
  const recentSongs = await getRecentSongs()

  return (
    <div className="flex flex-col items-center gap-12 py-10">
      {/* 검색창 */}
      <div className="w-full max-w-2xl space-y-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">가사의 숨겨진 의미</h1>
        <p className="text-lg text-zinc-500">한 줄 한 줄, 진짜 의미를 찾아보세요</p>
        <div className="pt-4">
          <SearchBar />
        </div>
      </div>

      {/* 최근 해석된 곡 */}
      {recentSongs.length > 0 && (
        <section className="w-full">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            최근 해석된 곡
          </h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {recentSongs.map((song) => (
              <Link
                key={song.id}
                href={`/songs/${song.id}`}
                className="group flex flex-col gap-2"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg">
                  {song.image_url ? (
                    <img
                      src={song.image_url}
                      alt={song.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                      ♪
                    </div>
                  )}
                </div>
                <div>
                  <p className="truncate text-sm font-medium">{song.title}</p>
                  <p className="truncate text-xs text-zinc-500">{song.artist}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Spotify 연동 유도 배너 (로그인은 됐지만 Spotify 미연동) */}
      {hasSession && (
        <div className="w-full max-w-2xl rounded-2xl bg-green-50 p-5 dark:bg-green-950/30">
          <p className="font-medium text-green-800 dark:text-green-300">
            💚 Spotify를 연동하면 지금 듣는 곡을 바로 해석할 수 있어요
          </p>
          <Link
            href="/profile"
            className="mt-2 inline-block text-sm text-green-600 underline dark:text-green-400"
          >
            프로필에서 연동하기 →
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 커밋**

```bash
git add components/home/
git commit -m "feat: home components for Spotify and default states"
```

---

## Task 5: 홈 페이지 분기 로직 업데이트

**Files:**
- Modify: `app/(main)/page.tsx`

- [ ] **Step 1: 서버 컴포넌트에서 세션 + Spotify 연동 여부 확인**

```tsx
// app/(main)/page.tsx
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SpotifyHome } from '@/components/home/SpotifyHome'
import { DefaultHome } from '@/components/home/DefaultHome'

async function hasSpotifyLinked(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'spotify' },
    select: { id: true },
  })
  return account != null
}

export default async function HomePage() {
  const session = await auth()

  if (session?.user?.id) {
    const spotifyLinked = await hasSpotifyLinked(session.user.id)
    if (spotifyLinked) {
      return <SpotifyHome />
    }
    return <DefaultHome hasSession={true} />
  }

  return <DefaultHome hasSession={false} />
}
```

- [ ] **Step 2: 수동 테스트**

```
1. 비로그인 → 검색창 + 최근 해석 곡 표시
2. Google 로그인 → 검색창 + Spotify 연동 유도 배너
3. Spotify 로그인 → 현재 재생 곡 버튼 + Liked Songs 갤러리
4. Spotify 로그인 후 음악 재생 → 현재 재생 곡 카드 표시
5. 현재 재생 곡 카드 클릭 → 가사 페이지 자동 이동
```

- [ ] **Step 3: 커밋**

```bash
git add "app/(main)/page.tsx"
git commit -m "feat: home page state-based routing"
```

---

## Task 6: 프로필 페이지 (계정 연동)

**Files:**
- Create: `components/profile/AccountLinks.tsx`
- Create: `app/(main)/profile/page.tsx`

- [ ] **Step 1: 계정 연동 컴포넌트**

```tsx
// components/profile/AccountLinks.tsx
'use client'

import { signIn } from 'next-auth/react'

interface Account {
  provider: string
}

interface Props {
  accounts: Account[]
}

const PROVIDERS = [
  {
    id: 'google',
    label: 'Google',
    icon: '🔵',
    className: 'border bg-white hover:bg-zinc-50 text-zinc-800',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    icon: '💚',
    className: 'bg-green-500 hover:bg-green-600 text-white',
  },
]

export function AccountLinks({ accounts }: Props) {
  const linkedProviders = new Set(accounts.map((a) => a.provider))

  return (
    <div className="space-y-3">
      {PROVIDERS.map((provider) => {
        const isLinked = linkedProviders.has(provider.id)
        return (
          <div
            key={provider.id}
            className="flex items-center justify-between rounded-xl border p-4 dark:border-zinc-800"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{provider.icon}</span>
              <div>
                <p className="font-medium">{provider.label}</p>
                <p className="text-sm text-zinc-500">
                  {isLinked ? '연동됨' : '미연동'}
                </p>
              </div>
            </div>
            {isLinked ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                ✓ 연결됨
              </span>
            ) : (
              <button
                onClick={() => signIn(provider.id, { callbackUrl: '/profile' })}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${provider.className}`}
              >
                연동하기
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 프로필 페이지**

```tsx
// app/(main)/profile/page.tsx
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { AccountLinks } from '@/components/profile/AccountLinks'
import { signOut } from '@/lib/auth'

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      accounts: {
        select: { provider: true },
      },
    },
  })

  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-lg space-y-8">
      {/* 프로필 헤더 */}
      <div className="flex items-center gap-4">
        {user.image && (
          <img src={user.image} alt="" className="h-16 w-16 rounded-full" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{user.name ?? '사용자'}</h1>
          <p className="text-zinc-500">{user.email}</p>
        </div>
      </div>

      {/* 연동 계정 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">연동된 계정</h2>
        <AccountLinks accounts={user.accounts} />
      </section>

      {/* 로그아웃 */}
      <section>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/' })
          }}
        >
          <button
            type="submit"
            className="text-sm text-zinc-400 underline hover:text-zinc-600"
          >
            로그아웃
          </button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: 수동 테스트**

```
1. Google 로그인 → /profile 접속
2. Spotify "연동하기" 클릭 → Spotify OAuth → /profile 복귀
3. Spotify 항목이 "✓ 연결됨"으로 변경 확인
4. DB: prisma studio → Account 테이블에 spotify 레코드 추가됐는지 확인
5. 홈으로 이동 → SpotifyHome으로 전환됐는지 확인
```

- [ ] **Step 4: 커밋**

```bash
git add "app/(main)/profile" components/profile/
git commit -m "feat: profile page with account linking"
```

---

## Task 7: Dockerfile + Docker Compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: .dockerignore**

```
# .dockerignore
node_modules
.next
.git
.env.local
.env*.local
docs/
__tests__/
*.md
```

- [ ] **Step 2: Dockerfile (멀티스테이지)**

```dockerfile
# Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 빌드 시 환경변수는 ARG로 (민감정보 제외)
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 필요한 파일만 복사
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 3: next.config.ts에 standalone 출력 추가**

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 4: Docker Compose**

```yaml
# docker-compose.yml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_GOOGLE_ID: ${AUTH_GOOGLE_ID}
      AUTH_GOOGLE_SECRET: ${AUTH_GOOGLE_SECRET}
      SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID}
      SPOTIFY_CLIENT_SECRET: ${SPOTIFY_CLIENT_SECRET}
      GENIUS_ACCESS_TOKEN: ${GENIUS_ACCESS_TOKEN}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    networks:
      - underline

networks:
  underline:
    driver: bridge
```

> PostgreSQL은 이미 별도 Docker 컨테이너로 실행 중이므로 compose에 포함하지 않음.
> `DATABASE_URL`은 미니 PC의 PostgreSQL 컨테이너 IP 또는 호스트 네트워크로 연결.

- [ ] **Step 5: 빌드 테스트**

```bash
docker build -t under-line .
```
Expected: 빌드 성공, 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add Dockerfile docker-compose.yml .dockerignore next.config.ts
git commit -m "feat: Docker multi-stage build and compose"
```

---

## Task 8: Nginx 설정 (스트리밍 버퍼링 OFF)

**Files:**
- Create: `nginx/nginx.conf`

- [ ] **Step 1: Nginx 설정 파일 작성**

```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    # 기본 설정
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 10M;

    upstream nextjs {
        server app:3000;
        keepalive 64;
    }

    server {
        listen 80;
        server_name _;

        # NDJSON 스트리밍 라우트 — 버퍼링 반드시 OFF
        location /api/songs/ {
            proxy_pass http://nextjs;
            proxy_buffering off;           # 핵심: 스트리밍 UX 보호
            proxy_read_timeout 300s;       # GPT 최대 5분 허용
            proxy_http_version 1.1;
            proxy_set_header Connection '';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # 나머지 모든 라우트
        location / {
            proxy_pass http://nextjs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

- [ ] **Step 2: docker-compose.yml에 Nginx 추가**

```yaml
# docker-compose.yml (업데이트)
services:
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app
    networks:
      - underline

  app:
    build: .
    restart: unless-stopped
    # ports: "3000:3000" 제거 (Nginx가 앞단에서 처리)
    expose:
      - "3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_GOOGLE_ID: ${AUTH_GOOGLE_ID}
      AUTH_GOOGLE_SECRET: ${AUTH_GOOGLE_SECRET}
      SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID}
      SPOTIFY_CLIENT_SECRET: ${SPOTIFY_CLIENT_SECRET}
      GENIUS_ACCESS_TOKEN: ${GENIUS_ACCESS_TOKEN}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
    networks:
      - underline

networks:
  underline:
    driver: bridge
```

- [ ] **Step 3: .env.local에 NEXTAUTH_URL 추가**

```env
# 배포 환경
NEXTAUTH_URL=http://YOUR_MINI_PC_IP
```

- [ ] **Step 4: 전체 스택 실행 테스트**

```bash
# 환경변수 파일 준비 (.env 파일로 compose에 전달)
cp .env.local .env

docker compose up -d

# 스트리밍 테스트 — 줄별로 즉시 출력되는지 확인
curl -N http://localhost/api/songs/{SONG_ID}/lyrics
```

Expected: 응답이 한 번에 오지 않고 줄 단위로 실시간 출력됨.

- [ ] **Step 5: 커밋**

```bash
git add nginx/ docker-compose.yml
git commit -m "feat: Nginx config with streaming buffering disabled"
```

---

## Task 9: Swagger에 Spotify 엔드포인트 추가

- [ ] **Step 1: `/api/docs/route.ts` 태그 목록 업데이트**

`app/api/docs/route.ts`의 tags 배열에 이미 Spotify가 포함되어 있어 별도 수정 불필요.
Swagger UI(`http://localhost/docs`)에서 Spotify 엔드포인트 확인.

- [ ] **Step 2: 수동 확인**

```
http://localhost/docs 접속
→ Spotify 섹션에 now-playing, liked-songs 표시 확인
```

- [ ] **Step 3: 커밋**

```bash
git commit --allow-empty -m "docs: verify Swagger covers Spotify endpoints"
```

---

## Plan B 완료 체크리스트

- [ ] Spotify 연동 후 홈에서 현재 재생 중인 곡 표시
- [ ] 현재 재생 곡 클릭 → 자동으로 Genius 검색 → 가사 페이지 이동
- [ ] Liked Songs 갤러리 표시 + 클릭 시 가사 페이지 이동
- [ ] Spotify 토큰 만료 시 자동 갱신 (1시간 후 재시도해도 동작)
- [ ] Google 로그인 후 /profile → Spotify 연동 → 홈이 Spotify 모드로 전환
- [ ] `docker compose up -d` 로 전체 스택 실행
- [ ] `curl -N http://localhost/api/songs/{id}/lyrics` → 줄 단위 실시간 출력 (Nginx 버퍼링 OFF 확인)
- [ ] Swagger UI `/docs`에서 Spotify 엔드포인트 확인
- [ ] 모든 단위 테스트 PASS

**배포 완료 후 접속:** `http://YOUR_MINI_PC_IP`
