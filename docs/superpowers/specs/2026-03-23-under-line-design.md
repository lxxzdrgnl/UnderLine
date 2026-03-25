# Under-Line — 설계 문서

**날짜:** 2026-03-23 (rev. 2026-03-24)
**프로젝트:** under-line
**스택:** Next.js 16 (App Router) · PostgreSQL · Prisma · OpenAI GPT-4o · Genius API · Spotify API · NextAuth.js

---

## 1. 서비스 개요

영문(및 다국어) 가사를 검색하면 줄별 한국어 번역 + AI 해석을 제공하는 풀스택 웹 서비스.
Spotify 연동 시 현재 재생 중인 곡을 즉시 해석할 수 있다.

**다국어 처리:**
GPT가 원문 언어를 자동 감지하여 분기한다.
- 원문이 한국어 → 번역 생략, 해석만 제공 (`translation: null`)
- 원문이 그 외 언어 → 한국어 번역 + 해석

UI는 `translation`이 null이면 번역 줄을 렌더링하지 않는다.

---

## 2. 아키텍처

단일 Next.js 앱 (Node Runtime). Route Handlers가 백엔드 역할을 겸한다.

```
[브라우저]
    ↕ fetch / NDJSON streaming
[Next.js App Router — Node Runtime]
    ├── app/(pages)/                  ← UI
    └── app/api/
            ├── auth/[...nextauth]    ← NextAuth (Google + Spotify OAuth)
            ├── spotify/now-playing   ← 현재 재생 곡
            ├── spotify/liked-songs   ← Liked Songs 목록
            ├── songs/search          ← Genius 검색
            ├── songs/[id]            ← 곡 메타데이터
            └── songs/[id]/lyrics     ← 스크래핑 + GPT 스트리밍
                    ↕ Prisma ORM
              [PostgreSQL — Docker]
```

> **Next.js 16 주의:** Route Handler의 `params`는 `Promise`다.
> ```ts
> export async function GET(
>   request: NextRequest,
>   { params }: { params: Promise<{ id: string }> }
> ) {
>   const { id } = await params
> }
> ```
> `/api/songs/[id]`, `/api/songs/[id]/lyrics` 모두 해당.

---

## 3. DB 스키마

```prisma
// NextAuth 필수 테이블
model User {
  id         String    @id @default(cuid())
  name       String?
  email      String?   @unique
  image      String?
  accounts   Account[]
  sessions   Session[]
  created_at DateTime  @default(now())
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String  // "spotify" | "google"
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?    // Unix timestamp (seconds)
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

// 앱 도메인 테이블
model Song {
  id            String       @id @default(cuid())
  genius_id     String       @unique
  title         String
  artist        String
  image_url     String?
  genius_path   String
  lyrics_status LyricsStatus @default(NONE)
  locked_at     DateTime?
  generation_id String?      // idempotency key
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
  translation   String? // null: 원문이 한국어인 경우
  slang         String? @db.Text // null: 슬랭/은어 없는 경우
  explanation   String? @db.Text // null: 설명할 내용 없는 경우
  generation_id String
  song          Song    @relation(fields: [song_id], references: [id])

  @@unique([song_id, line_number])
}

enum LyricsStatus { NONE PROCESSING DONE FAILED }
```

---

## 4. 핵심 로직: 가사 생성 플로우

```
GET /api/songs/[id]/lyrics
export const maxDuration = 300  // 필수 — GPT 스트리밍은 최대 5분 허용

① lyrics_status = DONE
   → LyricLine 전체를 NDJSON으로 즉시 스트리밍 (fast-path도 동일 NDJSON 형식)

② lyrics_status = PROCESSING AND locked_at > now() - 5분
   → 202 반환, 클라이언트 3초 폴링

③ lyrics_status = NONE
   OR (PROCESSING AND locked_at < now() - 5분)  ← stale lock
   OR FAILED  ← 재시도 허용
   → Atomic lock 획득:
     prisma.song.updateMany({
       where: { id, status: NONE } OR { id, status: PROCESSING, locked_at < now()-5m } OR { id, status: FAILED }
       data:  { status: PROCESSING, locked_at: now(), generation_id: newUUID() }
     })
     count = 0 → 202 반환
     count = 1 → 락 획득

④ 기존 LyricLine 삭제 (overwrite 전략 — resume 없음)
   prisma.lyricLine.deleteMany({ where: { song_id: id } })

⑤ SongLyricsRaw 없으면 Genius 페이지 스크래핑
   → GET https://genius.com/{genius_path}
   → div[data-lyrics-container="true"] 파싱 → raw_text 저장
   (주의: CSS 셀렉터는 Genius DOM 변경 시 깨질 수 있음 — raw_text 보존이 방어책)

⑥ Referents fetch (실패해도 치명적이지 않음 — 빈 배열로 진행)
   GET https://api.genius.com/referents?song_id={genius_id}&text_format=plain&per_page=50
   응답: referents[].fragment + referents[].annotations[0].body.plain
   → "구절: {fragment} / 해설: {annotation}" 형태로 flatten하여 GPT 컨텍스트로 전달

⑦ GPT-4o 스트리밍 호출
   프롬프트 지시:
   - 원문 언어 자동 감지
   - 한국어이면 translation: null, 그 외 언어이면 자연스러운 한국어 번역
   - slang: 슬랭/은어가 있으면 1문장 정의, 없으면 null
   - explanation:
       Genius 주석 있는 줄 → 주석을 자연스러운 한국어로 번역
                              + 추가할 내용 있을 때만 뒤에 덧붙임
       Genius 주석 없는 줄 → 설명할 내용(슬랭 배경, 문화적 맥락 등) 있으면 작성,
                              없으면 null (억지로 채우지 말 것)
   - 각 줄 처리 즉시 아래 NDJSON 형식으로 출력:
     {"line":1,"original":"...","translation":"...","slang":null,"explanation":"..."}

⑧ 10줄 버퍼 → prisma.lyricLine.createMany() 배치 insert

⑨ 완료 → lyrics_status = DONE
   실패 → LyricLine 삭제 + lyrics_status = FAILED (클라이언트에 에러 반환)
```

---

## 5. 인증 플로우

**로그인 수단:** Google OAuth, Spotify OAuth (NextAuth.js Prisma Adapter)

**Spotify 토큰 갱신:**
Spotify access token은 1시간 후 만료. `/api/spotify/*` 핸들러 진입 시:
```
Account.expires_at < now() → refresh_token으로 갱신 → Account 업데이트 → 재시도
갱신 실패 → 401 반환, 클라이언트는 Spotify 재연동 유도
```
NextAuth JWT callback에서도 토큰 갱신 로직 처리.

**계정 연동 (B안 — 수동):**
- 기본 로그인은 Google 또는 Spotify 단독
- 마이페이지 → [Spotify 연동] 버튼 → 세션 유지 상태에서 OAuth
- NextAuth `signIn` 콜백에서 활성 세션 감지 시 신규 User 생성 대신 기존 User에 Account 추가
  ```ts
  // [...nextauth].ts signIn callback
  async signIn({ user, account }) {
    const existingSession = await getServerSession()
    if (existingSession) {
      // 기존 User에 Account 연결 (create only if not exists)
      await prisma.account.upsert({ where: ..., create: ..., update: {} })
      return true
    }
    return true // 신규 로그인
  }
  ```
- 연동 완료 시 홈 화면 Spotify 모드로 전환

---

## 6. 홈 화면 UX (로그인 상태별)

### Spotify 연동됨
```
▶  현재 재생 중인 곡 해석하기  (메인 CTA)
❤️  내 Liked Songs 갤러리      (앨범 커버 그리드)
🔍  검색창
```

### 비로그인 / Google만
```
🔍  커다란 검색창 ("어떤 곡의 숨겨진 의미가 궁금하신가요?")
📀  최근 해석된 곡 갤러리      (DB 캐시 기반)
💚  Spotify 연동 유도 배너
```

---

## 7. 가사 페이지 UX

```
PC:     [원문 + 번역 60%] | [해석 패널 40%] ← 줄 클릭 시
모바일: 원문 + 번역 스크롤 → 줄 클릭 → 하단 모달

번역이 null(한국어 곡)이면 번역 줄 미렌더링

첫 조회: 위에서 아래로 줄 단위 스트리밍
이후 조회: DB에서 즉시 로드 (동일 NDJSON 형식)
스트리밍 중단 시: 에러 메시지 + 재시도 버튼 표시
```

---

## 8. 검색 최적화 및 안전장치

- 클라이언트 debounce 300ms (라이브 검색 시 Genius API 과호출 방지)
- 검색 결과 서버 메모리 캐시 (TTL 60s)
- IP 기반 Rate Limiting (`middleware.ts` 슬라이딩 윈도우):
  - `/api/songs/search` → 분당 30회
  - `/api/songs/[id]/lyrics` → 분당 5회 (GPT 호출 보호)
  - 초과 시 429 + `Retry-After` 헤더 반환

## 8-1. Nginx 스트리밍 설정 (배포 필수)

NDJSON 스트리밍이 Nginx 버퍼링으로 무력화되지 않도록 설정 필수:

```nginx
location /api/songs/ {
    proxy_pass http://localhost:3000;
    proxy_buffering off;       # NDJSON 스트리밍 필수
    proxy_read_timeout 300s;   # GPT 처리 시간 허용
    proxy_http_version 1.1;
    proxy_set_header Connection '';
}
```

---

## 9. API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth |
| GET | `/api/spotify/now-playing` | 현재 재생 곡 (토큰 갱신 포함) |
| GET | `/api/spotify/liked-songs` | Liked Songs 목록 |
| GET | `/api/songs/search?q=` | Genius 검색 |
| GET | `/api/songs/[id]` | 곡 메타데이터 |
| GET | `/api/songs/[id]/lyrics` | 가사 + 번역 + 해석 (NDJSON) |

---

## 10. 페이지 라우팅

```
/              ← 홈 (상태별 분기)
/songs/[id]    ← 가사 + 해석
/profile       ← 마이페이지 (계정 연동)
```

---

## 11. 환경 변수

```env
# DB
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Spotify OAuth
GENIUS_CLIENT_ID=...
GENIUS_CLIENT_SECRET=...
GENIUS_ACCESS_TOKEN=...

# Spotify
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...

# OpenAI
OPENAI_API_KEY=...
```

---

## 12. 동시성 / 안정성 요약

| 문제 | 해결 |
|------|------|
| Race condition | Atomic updateMany lock |
| Stale lock (서버 죽음) | locked_at 타임스탬프 5분 만료 |
| GPT 중복 호출 | generation_id (신규 UUID로 교체) |
| 부분 실패 데이터 오염 | 재시도 시 LyricLine 전체 삭제 후 재생성 |
| DB 과부하 | 10줄 버퍼 → batch insertMany |
| 스크래핑 DOM 변경 | SongLyricsRaw에 원본 보존 |
| 영구 실패 방치 | FAILED 상태 + 재시도 허용 |
| 한국어/다국어 곡 | GPT 언어 감지 → translation null 처리 |

---

## 13. 모바일 확장 (React Native — 추후)

웹 데이터 API(`/api/songs/*`, `/api/spotify/*`)는 React Native에서 그대로 호출 가능.
NextAuth는 쿠키 기반이므로 모바일 전용 인증 엔드포인트 추가 필요:

```
POST /api/auth/mobile/login
→ Spotify/Google 토큰 검증 → JWT 발급
React Native: AsyncStorage에 저장 → Authorization: Bearer {token}
```

현재 설계는 이 확장을 고려한 구조. 데이터 API는 수정 없음.

---

## 14. 배포

- Docker 컨테이너 (Next.js 앱)
- PostgreSQL: 기존 Docker 컨테이너 재사용
- 로컬 mini PC 서버

---

## 15. RBAC (역할 기반 접근 제어)

**역할:** `ROLE_USER` (기본), `ROLE_ADMIN`

**DB 스키마 추가:**
```prisma
enum Role { ROLE_USER ROLE_ADMIN }

model User {
  ...
  role Role @default(ROLE_USER)
}
```

**NextAuth 세션 확장:**
```ts
// types/next-auth.d.ts
declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role }
  }
}
```

**보호 패턴:**
```ts
// lib/auth-guard.ts
export async function requireAdmin(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json(apiError(401, 'UNAUTHORIZED'), { status: 401 })
  if (session.user.role !== 'ROLE_ADMIN') return NextResponse.json(apiError(403, 'FORBIDDEN'), { status: 403 })
  return null
}
```

**어드민 전용 엔드포인트 (3개):**
- `GET /api/admin/songs` — 전체 곡 목록 + 상태 (페이지네이션)
- `DELETE /api/admin/songs/[id]` — 곡 + 가사 삭제
- `POST /api/admin/songs/[id]/reset` — lyrics_status → NONE (강제 재생성)

---

## 16. 표준 에러 응답 포맷 및 에러 코드

**에러 응답 구조:**
```json
{
  "timestamp": "2026-03-24T12:00:00.000Z",
  "path": "/api/songs/123",
  "status": 404,
  "code": "SONG_NOT_FOUND",
  "message": "Song not found",
  "details": null
}
```

**표준 에러 코드 (15개):**

| Code | HTTP | 설명 |
|------|------|------|
| `BAD_REQUEST` | 400 | 잘못된 요청 파라미터 |
| `UNAUTHORIZED` | 401 | 인증 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `SONG_NOT_FOUND` | 404 | 곡 없음 |
| `LYRICS_NOT_FOUND` | 404 | 가사 없음 |
| `USER_NOT_FOUND` | 404 | 유저 없음 |
| `CONFLICT` | 409 | 중복/충돌 |
| `RATE_LIMITED` | 429 | 요청 횟수 초과 |
| `LYRICS_PROCESSING` | 202 | 가사 생성 중 (에러 아님, 폴링용) |
| `GENIUS_API_ERROR` | 502 | Genius API 오류 |
| `OPENAI_API_ERROR` | 502 | OpenAI API 오류 |
| `SPOTIFY_AUTH_ERROR` | 401 | Spotify 토큰 만료/갱신 실패 |
| `SCRAPING_FAILED` | 502 | 가사 스크래핑 실패 |
| `INTERNAL_ERROR` | 500 | 내부 서버 오류 |
| `UNKNOWN_ERROR` | 500 | 알 수 없는 오류 |

**헬퍼 함수:**
```ts
// lib/api-error.ts
export function apiError(status: number, code: ErrorCode, message?: string, details?: unknown) {
  return { timestamp: new Date().toISOString(), path: '', status, code, message: message ?? code, details: details ?? null }
}
```
(path는 Route Handler에서 `req.nextUrl.pathname`으로 채움)

---

## 17. 페이지네이션

**공통 쿼리 파라미터:**
- `page` (default: 1, min: 1)
- `size` (default: 20, max: 100)
- `sort` (예: `created_at`, `-created_at` = 내림차순)
- `filter` (엔드포인트별 정의)

**응답 구조:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**N+1 방지:** Prisma `include`는 항상 필요한 relation만 명시. `select`로 불필요한 컬럼 제외.

적용 엔드포인트:
- `GET /api/admin/songs` (admin)
- `GET /api/spotify/liked-songs`

---

## 18. 헬스체크

```
GET /api/health
- 인증 불필요
- 응답: { status: "ok", version: string, buildTime: string }
- buildTime은 빌드 시 주입 (NEXT_PUBLIC_BUILD_TIME env var)
```

---

## 19. 요청/응답 로깅

`middleware.ts` 또는 별도 `lib/logger.ts`에서 처리.

**로그 항목:** `method`, `path`, `status`, `latency(ms)`, `userId`(있으면)

**형식:**
```
[2026-03-24T12:00:00Z] GET /api/songs/search?q=eminem 200 45ms
```

- 개발: `console.log`
- 프로덕션: 동일 (추후 외부 로거 교체 가능하도록 `lib/logger.ts`로 분리)
