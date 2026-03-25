export const dynamic = 'force-dynamic'

const E401 = {
  description: '인증 필요 — 로그인 세션 없음',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: {
    error: { code: 'UNAUTHORIZED', message: 'Login required', status: 401, path: '/api/...' },
  }}},
}
const E403 = {
  description: '권한 없음 — ADMIN 역할 필요',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: {
    error: { code: 'FORBIDDEN', message: 'Admin access required', status: 403, path: '/api/admin/...' },
  }}},
}
const E404 = (resource = '리소스') => ({
  description: `${resource} 없음`,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: {
    error: { code: 'SONG_NOT_FOUND', message: 'Song not found', status: 404, path: '/api/songs/abc123' },
  }}},
})
const E422 = (detail = '요청 바디 유효성 오류') => ({
  description: `처리 불가 — ${detail}`,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: {
    error: { code: 'VALIDATION_ERROR', message: detail, status: 422, path: '/api/...' },
  }}},
})
const E429 = (limit = '60회/분') => ({
  description: `요청 한도 초과 (${limit})`,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: {
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.', status: 429, path: '/api/...' },
  }}},
  headers: {
    'X-RateLimit-Limit': { schema: { type: 'integer' }, description: '허용 요청 수' },
    'X-RateLimit-Remaining': { schema: { type: 'integer' }, description: '남은 요청 수' },
    'X-RateLimit-Reset': { schema: { type: 'integer' }, description: '리셋 시각 (Unix timestamp)' },
    'Retry-After': { schema: { type: 'integer' }, description: '재시도까지 남은 초' },
  },
})
const E500 = {
  description: '서버 내부 오류',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: {
    error: { code: 'GENIUS_API_ERROR', message: 'Upstream API failed', status: 500, path: '/api/songs/search' },
  }}},
}

export async function GET() {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'Under-Line API',
      version: '1.0.0',
      description: [
        'AI 기반 가사 해석 서비스 API.',
        '',
        '**흐름**',
        '1. `GET /api/songs/search?q=` 로 곡 검색',
        '2. `POST /api/songs` 로 곡 DB 등록 → `id` 획득',
        '3. `GET /api/songs/{id}/lyrics` 로 NDJSON 스트리밍 해석 수신',
        '',
        '**인증**: Next Auth 세션 쿠키 (`authjs.session-token`). 브라우저에서 자동 전송.',
        '',
        '**Rate Limit**: 모든 `/api/*` 경로에 적용 (기본 60회/분).',
      ].join('\n'),
    },
    tags: [
      { name: 'Songs', description: '곡 검색, 메타데이터, 가사 해석' },
      { name: 'Search', description: '통합 검색 — 곡, 아티스트, 앨범' },
      { name: 'Playlists', description: '플레이리스트 관리 (로그인 필요)' },
      { name: 'Spotify', description: 'Spotify 연동 — 현재 재생 중인 곡, 플레이리스트' },
      { name: 'User', description: '검색 기록, 연결된 계정 (로그인 필요)' },
      { name: 'Admin', description: '관리자 전용 (ADMIN 역할 필요)' },
    ],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'authjs.session-token',
          description: 'Next Auth 세션 쿠키. 브라우저에서 자동 전송됩니다.',
        },
      },
      schemas: {
        ApiError: {
          type: 'object',
          description: '모든 에러 응답의 공통 형식',
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'status', 'path'],
              properties: {
                code: { type: 'string', example: 'SONG_NOT_FOUND', description: '에러 식별 코드' },
                message: { type: 'string', example: 'Song not found', description: '에러 설명' },
                status: { type: 'integer', example: 404, description: 'HTTP 상태 코드' },
                path: { type: 'string', example: '/api/songs/abc123', description: '요청 경로' },
              },
            },
          },
          example: {
            error: { code: 'SONG_NOT_FOUND', message: 'Song not found', status: 404, path: '/api/songs/abc123' },
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            genius_id: { type: 'string', example: '3039923' },
            title: { type: 'string', example: 'HUMBLE.' },
            artist: { type: 'string', example: 'Kendrick Lamar' },
            image_url: { type: 'string', nullable: true, example: 'https://images.genius.com/...' },
            genius_path: { type: 'string', example: '/kendrick-lamar-humble-lyrics' },
            db_id: { type: 'string', format: 'uuid', nullable: true, description: 'DB에 저장된 경우 내부 UUID. 없으면 null.' },
            lyrics_status: { type: 'string', nullable: true, enum: ['NONE', 'PROCESSING', 'DONE'], description: '가사 처리 상태. DB에 없으면 null.' },
          },
          example: {
            genius_id: '3039923', title: 'HUMBLE.', artist: 'Kendrick Lamar',
            image_url: 'https://images.genius.com/humble.jpg',
            genius_path: '/kendrick-lamar-humble-lyrics',
            db_id: 'a1b2c3d4-...', lyrics_status: 'DONE',
          },
        },
        Song: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-...' },
            genius_id: { type: 'string', example: '3039923' },
            title: { type: 'string', example: 'HUMBLE.' },
            artist: { type: 'string', example: 'Kendrick Lamar' },
            image_url: { type: 'string', nullable: true },
            genius_path: { type: 'string', example: '/kendrick-lamar-humble-lyrics' },
            lyrics_status: { type: 'string', enum: ['NONE', 'PROCESSING', 'DONE'], example: 'DONE' },
          },
        },
        LyricLine: {
          type: 'object',
          description: 'NDJSON 스트림의 한 줄. 각 줄은 이 객체의 JSON 직렬화 + \\n.',
          required: ['line', 'original'],
          properties: {
            line: { type: 'integer', example: 1, description: '가사 줄 번호 (1-indexed)' },
            original: { type: 'string', example: "Sit down, be humble", description: '원문 가사' },
            translation: { type: 'string', nullable: true, example: "앉아, 겸손해져", description: '한국어 번역' },
            slang: { type: 'string', nullable: true, example: "be humble: 자만하지 말라는 직접적 명령", description: '슬랭/속어 설명' },
            explanation: { type: 'string', nullable: true, example: "Kendrick이 라이벌 래퍼들에게 보내는 경고 메시지", description: '문화적 맥락 및 해석' },
          },
          example: {
            line: 1, original: "Sit down, be humble",
            translation: "앉아, 겸손해져",
            slang: "be humble: 거만하게 굴지 말라는 명령",
            explanation: "Kendrick이 떠오르는 라이벌들에게 자신의 위치를 알라고 경고하는 구절",
          },
        },
        NowPlayingTrack: {
          type: 'object',
          nullable: true,
          description: '현재 재생 중인 트랙. 재생 중인 곡 없으면 null.',
          properties: {
            title: { type: 'string', example: 'HUMBLE.' },
            artist: { type: 'string', example: 'Kendrick Lamar' },
            image_url: { type: 'string', nullable: true, example: 'https://i.scdn.co/image/...' },
            is_playing: { type: 'boolean', example: true },
            progress_ms: { type: 'integer', example: 45000, description: '현재 재생 위치 (ms)' },
            duration_ms: { type: 'integer', example: 177000, description: '곡 전체 길이 (ms)' },
          },
          example: {
            title: 'HUMBLE.', artist: 'Kendrick Lamar',
            image_url: 'https://i.scdn.co/image/humble.jpg',
            is_playing: true, progress_ms: 45000, duration_ms: 177000,
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            size: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 142 },
            totalPages: { type: 'integer', example: 8 },
          },
        },
        Playlist: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' },
            name: { type: 'string', example: 'My Favourites' },
            isDefault: { type: 'boolean', example: false },
            songCount: { type: 'integer', example: 12 },
            coverImage: { type: 'string', nullable: true, example: 'https://images.genius.com/humble.jpg' },
            createdAt: { type: 'string', format: 'date-time', example: '2026-01-15T09:30:00.000Z' },
          },
        },
        PlaylistSong: {
          type: 'object',
          properties: {
            playlistSongId: { type: 'string', format: 'uuid', example: 'c3d4e5f6-a7b8-9012-cdef-123456789012' },
            songId: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
            position: { type: 'integer', example: 1 },
            addedAt: { type: 'string', format: 'date-time', example: '2026-01-16T12:00:00.000Z' },
            genius_id: { type: 'string', example: '3039923' },
            title: { type: 'string', example: 'HUMBLE.' },
            artist: { type: 'string', example: 'Kendrick Lamar' },
            image_url: { type: 'string', nullable: true, example: 'https://images.genius.com/humble.jpg' },
          },
        },
        SpotifyPlaylist: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '37i9dQZF1DXcBWIGoYBM5M' },
            name: { type: 'string', example: 'Today\'s Top Hits' },
            trackCount: { type: 'integer', example: 50 },
            image_url: { type: 'string', nullable: true, example: 'https://i.scdn.co/image/abc123' },
          },
        },
      },
    },
    paths: {
      '/api/search': {
        get: {
          summary: '통합 검색',
          description: '곡, 아티스트, 앨범을 통합 검색합니다.',
          tags: ['Search'],
          parameters: [
            {
              in: 'query', name: 'q', required: true,
              schema: { type: 'string', minLength: 1 },
              description: '검색 키워드',
              example: 'Kendrick Lamar',
            },
            {
              in: 'query', name: 'type', required: false,
              schema: { type: 'string', enum: ['songs', 'artists', 'albums'] },
              description: '검색 대상 유형',
              example: 'songs',
            },
          ],
          responses: {
            200: {
              description: '검색 결과 배열',
              content: { 'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SearchResult' },
                },
                example: [{
                  genius_id: '3039923', title: 'HUMBLE.', artist: 'Kendrick Lamar',
                  image_url: 'https://images.genius.com/humble.jpg',
                  genius_path: '/kendrick-lamar-humble-lyrics',
                  db_id: 'a1b2c3d4-...', lyrics_status: 'DONE',
                }],
              }},
            },
            429: E429(),
            500: E500,
          },
        },
      },
      '/api/playlists': {
        get: {
          summary: '플레이리스트 목록 조회',
          description: '로그인 유저의 모든 플레이리스트 목록을 반환합니다.',
          tags: ['Playlists'],
          security: [{ sessionCookie: [] }],
          responses: {
            200: {
              description: '플레이리스트 목록',
              content: { 'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    playlists: { type: 'array', items: { $ref: '#/components/schemas/Playlist' } },
                    count: { type: 'integer', example: 3 },
                  },
                },
                example: {
                  playlists: [{
                    id: 'b2c3d4e5-...', name: 'My Favourites', isDefault: false,
                    songCount: 12, coverImage: null, createdAt: '2026-01-15T09:30:00.000Z',
                  }],
                  count: 1,
                },
              }},
            },
            401: E401,
            429: E429(),
          },
        },
        post: {
          summary: '플레이리스트 생성',
          description: '새 플레이리스트를 생성합니다. 이름 중복 또는 한도 초과 시 422를 반환합니다.',
          tags: ['Playlists'],
          security: [{ sessionCookie: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Chill Vibes' },
                },
              },
              example: { name: 'Chill Vibes' },
            }},
          },
          responses: {
            201: {
              description: '생성된 플레이리스트',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/Playlist' },
                example: {
                  id: 'b2c3d4e5-...', name: 'Chill Vibes', isDefault: false,
                  songCount: 0, coverImage: null, createdAt: '2026-03-25T10:00:00.000Z',
                },
              }},
            },
            401: E401,
            422: E422('name 중복 또는 플레이리스트 한도 초과'),
            429: E429(),
          },
        },
      },
      '/api/playlists/{id}': {
        delete: {
          summary: '플레이리스트 삭제',
          description: '지정한 플레이리스트를 삭제합니다. 기본(default) 플레이리스트는 삭제할 수 없습니다.',
          tags: ['Playlists'],
          security: [{ sessionCookie: [] }],
          parameters: [{
            in: 'path', name: 'id', required: true,
            schema: { type: 'string', format: 'uuid' },
            example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          }],
          responses: {
            204: { description: '삭제 성공 (본문 없음)' },
            401: E401,
            403: { description: '기본 플레이리스트 또는 권한 없음', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: { error: { code: 'FORBIDDEN', message: 'Cannot delete default playlist', status: 403, path: '/api/playlists/b2c3d4e5-...' } } } } },
            404: E404('플레이리스트'),
            429: E429(),
          },
        },
      },
      '/api/playlists/{id}/songs': {
        get: {
          summary: '플레이리스트 곡 목록',
          description: '플레이리스트에 속한 곡들을 position 순으로 반환합니다.',
          tags: ['Playlists'],
          security: [{ sessionCookie: [] }],
          parameters: [{
            in: 'path', name: 'id', required: true,
            schema: { type: 'string', format: 'uuid' },
            example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          }],
          responses: {
            200: {
              description: 'position 순 곡 목록',
              content: { 'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/PlaylistSong' },
                },
                example: [{
                  playlistSongId: 'c3d4e5f6-...', songId: 'a1b2c3d4-...',
                  position: 1, addedAt: '2026-01-16T12:00:00.000Z',
                  genius_id: '3039923', title: 'HUMBLE.', artist: 'Kendrick Lamar', image_url: null,
                }],
              }},
            },
            401: E401,
            404: E404('플레이리스트'),
            429: E429(),
          },
        },
        post: {
          summary: '플레이리스트에 곡 추가',
          description: '플레이리스트에 곡을 추가합니다. 이미 존재하면 멱등적으로 처리됩니다.',
          tags: ['Playlists'],
          security: [{ sessionCookie: [] }],
          parameters: [{
            in: 'path', name: 'id', required: true,
            schema: { type: 'string', format: 'uuid' },
            example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          }],
          requestBody: {
            required: true,
            content: { 'application/json': {
              schema: {
                type: 'object',
                required: ['songId'],
                properties: {
                  songId: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
                },
              },
              example: { songId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
            }},
          },
          responses: {
            200: {
              description: '추가 성공 (이미 존재해도 200)',
              content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } }, example: { ok: true } } },
            },
            401: E401,
            404: E404('플레이리스트 또는 곡'),
            422: E422('songId 필드 필수'),
            429: E429(),
          },
        },
      },
      '/api/playlists/{id}/songs/{songId}': {
        delete: {
          summary: '플레이리스트에서 곡 제거',
          description: '플레이리스트에서 특정 곡을 제거합니다.',
          tags: ['Playlists'],
          security: [{ sessionCookie: [] }],
          parameters: [
            {
              in: 'path', name: 'id', required: true,
              schema: { type: 'string', format: 'uuid' },
              example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            },
            {
              in: 'path', name: 'songId', required: true,
              schema: { type: 'string', format: 'uuid' },
              example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            },
          ],
          responses: {
            204: { description: '제거 성공 (본문 없음)' },
            401: E401,
            404: E404('플레이리스트 또는 곡'),
            429: E429(),
          },
        },
      },
      '/api/playlists/{id}/songs/reorder': {
        put: {
          summary: '플레이리스트 곡 순서 변경',
          description: '플레이리스트 내 곡들의 순서를 재배치합니다. `order` 배열이 현재 곡 목록과 일치하지 않으면 422를 반환합니다.',
          tags: ['Playlists'],
          security: [{ sessionCookie: [] }],
          parameters: [{
            in: 'path', name: 'id', required: true,
            schema: { type: 'string', format: 'uuid' },
            example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          }],
          requestBody: {
            required: true,
            content: { 'application/json': {
              schema: {
                type: 'object',
                required: ['order'],
                properties: {
                  order: { type: 'array', items: { type: 'string', format: 'uuid' }, description: '새 순서의 songId 배열', example: ['a1b2c3d4-...', 'b2c3d4e5-...'] },
                },
              },
              example: { order: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'] },
            }},
          },
          responses: {
            200: {
              description: '순서 변경 성공',
              content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } }, example: { ok: true } } },
            },
            401: E401,
            404: E404('플레이리스트'),
            422: E422('order 배열이 현재 곡 목록과 불일치'),
            429: E429(),
          },
        },
      },
      '/api/songs/{id}/playlists': {
        get: {
          summary: '곡이 속한 플레이리스트 ID 목록',
          description: '로그인 유저의 플레이리스트 중 해당 곡이 포함된 플레이리스트 ID 배열을 반환합니다.',
          tags: ['Playlists'],
          security: [{ sessionCookie: [] }],
          parameters: [{
            in: 'path', name: 'id', required: true,
            schema: { type: 'string', format: 'uuid' },
            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          }],
          responses: {
            200: {
              description: '플레이리스트 ID 배열',
              content: { 'application/json': {
                schema: {
                  type: 'object',
                  properties: { playlistIds: { type: 'array', items: { type: 'string', format: 'uuid' } } },
                },
                example: { playlistIds: ['b2c3d4e5-f6a7-8901-bcde-f12345678901'] },
              }},
            },
            401: E401,
            404: E404('곡'),
            429: E429(),
          },
        },
      },
      '/api/spotify/playlists': {
        get: {
          summary: 'Spotify 플레이리스트 목록',
          description: '연결된 Spotify 계정의 플레이리스트 목록을 반환합니다. Spotify 연동이 없으면 403.',
          tags: ['Spotify'],
          security: [{ sessionCookie: [] }],
          responses: {
            200: {
              description: 'Spotify 플레이리스트 목록',
              content: { 'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SpotifyPlaylist' },
                },
                example: [{
                  id: '37i9dQZF1DXcBWIGoYBM5M', name: "Today's Top Hits",
                  trackCount: 50, image_url: 'https://i.scdn.co/image/abc123',
                }],
              }},
            },
            401: E401,
            403: { description: 'Spotify 계정 미연동', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: { error: { code: 'FORBIDDEN', message: 'Spotify account not linked', status: 403, path: '/api/spotify/playlists' } } } } },
            429: E429(),
            500: E500,
          },
        },
      },
      '/api/playlists/import/spotify': {
        post: {
          summary: 'Spotify 플레이리스트 가져오기',
          description: 'Spotify 플레이리스트를 Under-Line 플레이리스트로 가져옵니다. DB에 없는 곡은 건너뜁니다(`skipped`).',
          tags: ['Playlists'],
          security: [{ sessionCookie: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': {
              schema: {
                type: 'object',
                required: ['spotifyPlaylistId'],
                properties: {
                  spotifyPlaylistId: { type: 'string', example: '37i9dQZF1DXcBWIGoYBM5M' },
                  name: { type: 'string', nullable: true, example: 'Imported from Spotify', description: '지정하지 않으면 Spotify 플레이리스트 이름 사용' },
                },
              },
              example: { spotifyPlaylistId: '37i9dQZF1DXcBWIGoYBM5M', name: 'My Import' },
            }},
          },
          responses: {
            200: {
              description: '가져오기 결과',
              content: { 'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    playlistId: { type: 'string', format: 'uuid', example: 'b2c3d4e5-...' },
                    imported: { type: 'integer', example: 35, description: '성공적으로 추가된 곡 수' },
                    skipped: { type: 'integer', example: 15, description: 'DB에 없어 건너뛴 곡 수' },
                    total: { type: 'integer', example: 50, description: 'Spotify 플레이리스트 전체 트랙 수' },
                  },
                },
                example: { playlistId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', imported: 35, skipped: 15, total: 50 },
              }},
            },
            401: E401,
            403: { description: 'Spotify 계정 미연동', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: { error: { code: 'FORBIDDEN', message: 'Spotify account not linked', status: 403, path: '/api/playlists/import/spotify' } } } } },
            422: E422('spotifyPlaylistId 필드 필수'),
            429: E429(),
            500: E500,
          },
        },
      },
      '/api/songs/search': {
        get: {
          summary: '곡 검색',
          description: [
            'Genius API로 곡을 검색합니다.',
            '- 결과에 DB 캐시 여부(`db_id`)와 가사 처리 상태(`lyrics_status`)가 포함됩니다.',
            '- 쿼리 결과는 **60초** 인메모리 캐시 적용 (최대 200개 항목).',
            '- Rate Limit: **분당 30회**.',
          ].join('\n'),
          tags: ['Songs'],
          parameters: [{
            in: 'query', name: 'q', required: true,
            schema: { type: 'string', minLength: 2 },
            description: '검색 키워드 (2자 이상)',
            example: 'Kendrick Lamar HUMBLE',
          }],
          responses: {
            200: {
              description: '검색 결과 목록 (빈 쿼리는 `results: []` 반환)',
              content: { 'application/json': {
                schema: {
                  type: 'object',
                  properties: { results: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } } },
                },
                example: {
                  results: [{
                    genius_id: '3039923', title: 'HUMBLE.', artist: 'Kendrick Lamar',
                    image_url: 'https://images.genius.com/humble.jpg',
                    genius_path: '/kendrick-lamar-humble-lyrics',
                    db_id: 'a1b2c3d4-...', lyrics_status: 'DONE',
                  }],
                },
              }},
            },
            429: E429('30회/분'),
            500: E500,
          },
        },
      },
      '/api/songs': {
        post: {
          summary: '곡 upsert',
          description: [
            '검색 결과에서 곡을 선택할 때 호출됩니다.',
            'Genius에서 상세 메타데이터(앨범, 발매일, 스트리밍 링크 등)를 가져와 DB에 저장하거나 업데이트합니다.',
            '이미 존재하는 곡이면 메타데이터만 갱신하고 동일한 `id`를 반환합니다.',
          ].join('\n'),
          tags: ['Songs'],
          requestBody: {
            required: true,
            content: { 'application/json': {
              schema: {
                type: 'object',
                required: ['genius_id', 'title', 'artist'],
                properties: {
                  genius_id: { type: 'string', example: '3039923' },
                  title: { type: 'string', example: 'HUMBLE.' },
                  artist: { type: 'string', example: 'Kendrick Lamar' },
                  image_url: { type: 'string', nullable: true },
                  genius_path: { type: 'string', example: '/kendrick-lamar-humble-lyrics' },
                },
              },
              example: {
                genius_id: '3039923', title: 'HUMBLE.', artist: 'Kendrick Lamar',
                image_url: 'https://images.genius.com/humble.jpg',
                genius_path: '/kendrick-lamar-humble-lyrics',
              },
            }},
          },
          responses: {
            200: {
              description: '생성 또는 기존 곡의 내부 UUID',
              content: { 'application/json': {
                schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
                example: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
              }},
            },
            422: E422('genius_id, title, artist 필드 필수'),
            429: E429(),
            500: E500,
          },
        },
      },
      '/api/songs/{id}': {
        get: {
          summary: '곡 메타데이터 조회',
          description: '내부 UUID로 곡 메타데이터를 조회합니다.',
          tags: ['Songs'],
          parameters: [{
            in: 'path', name: 'id', required: true,
            schema: { type: 'string', format: 'uuid' },
            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          }],
          responses: {
            200: {
              description: '곡 메타데이터',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/Song' },
                example: {
                  id: 'a1b2c3d4-...', genius_id: '3039923',
                  title: 'HUMBLE.', artist: 'Kendrick Lamar',
                  image_url: 'https://images.genius.com/humble.jpg',
                  genius_path: '/kendrick-lamar-humble-lyrics',
                  lyrics_status: 'DONE',
                },
              }},
            },
            404: E404('곡'),
            429: E429(),
          },
        },
      },
      '/api/songs/{id}/lyrics': {
        get: {
          summary: '가사 + 해석 스트리밍 (NDJSON)',
          description: [
            'GPT-4o로 번역·해석·슬랭 설명을 생성해 **NDJSON 스트림**으로 반환합니다.',
            '',
            '**상태별 동작**',
            '| 상태 | 응답 | 클라이언트 처리 |',
            '|------|------|----------------|',
            '| 캐시 완료(`DONE`) | 200 즉시 스트리밍 | 그대로 렌더링 |',
            '| 처리 중(`PROCESSING`) | 202 | 3초 후 재시도 |',
            '| 미생성(`NONE`) | 200 GPT 스트리밍 시작 | 줄 단위 렌더링 |',
            '',
            '**NDJSON 형식**: 각 줄은 `LyricLine` JSON + `\\n`.',
            '',
            '**Rate Limit**: 분당 5회 (GPT API 비용 방어).',
          ].join('\n'),
          tags: ['Songs'],
          parameters: [{
            in: 'path', name: 'id', required: true,
            schema: { type: 'string', format: 'uuid' },
            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          }],
          responses: {
            200: {
              description: 'NDJSON 스트림 — 각 줄이 LyricLine JSON (\\n 구분)',
              content: {
                'application/x-ndjson': {
                  schema: { $ref: '#/components/schemas/LyricLine' },
                  example: '{"line":1,"original":"Sit down, be humble","translation":"앉아, 겸손해져","slang":"be humble: 거만하지 말라는 명령","explanation":"Kendrick이 라이벌에게 보내는 경고"}\n{"line":2,"original":"...","translation":"...","slang":null,"explanation":null}\n',
                },
              },
            },
            202: {
              description: '다른 프로세스가 처리 중 — 3초 후 재시도 요망',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/ApiError' },
                example: { error: { code: 'LYRICS_PROCESSING', message: 'Lyrics are being generated', status: 202, path: '/api/songs/abc/lyrics' } },
              }},
            },
            404: E404('곡'),
            429: E429('5회/분'),
            500: E500,
          },
        },
      },
      '/api/spotify/now-playing': {
        get: {
          summary: '현재 재생 중인 곡',
          description: 'Spotify 계정이 연결된 로그인 유저의 현재 재생 트랙을 반환합니다. 재생 중인 곡이 없으면 `null`.',
          tags: ['Spotify'],
          security: [{ sessionCookie: [] }],
          responses: {
            200: {
              description: '현재 재생 중인 트랙 (없으면 null)',
              content: { 'application/json': {
                schema: { $ref: '#/components/schemas/NowPlayingTrack' },
                examples: {
                  playing: {
                    summary: '재생 중',
                    value: { title: 'HUMBLE.', artist: 'Kendrick Lamar', image_url: 'https://i.scdn.co/...', is_playing: true, progress_ms: 45000, duration_ms: 177000 },
                  },
                  paused: {
                    summary: '일시정지',
                    value: { title: 'HUMBLE.', artist: 'Kendrick Lamar', image_url: 'https://i.scdn.co/...', is_playing: false, progress_ms: 12000, duration_ms: 177000 },
                  },
                  none: { summary: '재생 없음', value: null },
                },
              }},
            },
            401: E401,
            429: E429(),
          },
        },
      },
      '/api/user/search-history': {
        get: {
          summary: '최근 검색 기록',
          description: '로그인 유저의 최근 검색 10개. 미로그인 시 `[]` 반환 (에러 없음).',
          tags: ['User'],
          security: [{ sessionCookie: [] }],
          responses: {
            200: {
              description: '최근 검색 목록 (최대 10개, 최신순)',
              content: { 'application/json': {
                schema: {
                  type: 'array',
                  items: { type: 'object', properties: {
                    id: { type: 'string' },
                    genius_id: { type: 'string' },
                    title: { type: 'string' },
                    artist: { type: 'string' },
                    image_url: { type: 'string', nullable: true },
                  }},
                },
                example: [{ id: 'x1', genius_id: '3039923', title: 'HUMBLE.', artist: 'Kendrick Lamar', image_url: null }],
              }},
            },
            429: E429(),
          },
        },
        post: {
          summary: '검색 기록 저장',
          description: '곡 선택 시 upsert합니다. 중복이면 `created_at`을 갱신해 최상단으로 이동.',
          tags: ['User'],
          security: [{ sessionCookie: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': {
              schema: {
                type: 'object',
                required: ['genius_id'],
                properties: {
                  genius_id: { type: 'string', example: '3039923' },
                  title: { type: 'string', example: 'HUMBLE.' },
                  artist: { type: 'string', example: 'Kendrick Lamar' },
                  image_url: { type: 'string', nullable: true },
                },
              },
            }},
          },
          responses: {
            200: { description: '저장 성공', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } }, example: { ok: true } } } },
            400: { description: 'genius_id 누락', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' }, example: { error: { code: 'VALIDATION_ERROR', message: 'genius_id required', status: 400, path: '/api/user/search-history' } } } } },
            401: E401,
            422: E422('genius_id 필드 필수'),
            429: E429(),
          },
        },
        delete: {
          summary: '검색 기록 단건 삭제',
          tags: ['User'],
          security: [{ sessionCookie: [] }],
          parameters: [{
            in: 'query', name: 'genius_id', required: true,
            schema: { type: 'string' }, example: '3039923',
          }],
          responses: {
            200: { description: '삭제 성공', content: { 'application/json': { example: { ok: true } } } },
            400: { description: 'genius_id 누락' },
            401: E401,
            429: E429(),
          },
        },
      },
      '/api/user/accounts': {
        get: {
          summary: '연결된 계정 정보',
          description: '로그인 유저의 프로필 및 연결된 OAuth 프로바이더 목록.',
          tags: ['User'],
          security: [{ sessionCookie: [] }],
          responses: {
            200: {
              description: '유저 정보 및 연결 프로바이더',
              content: { 'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { type: 'object', properties: {
                      name: { type: 'string', nullable: true },
                      email: { type: 'string', nullable: true },
                      image: { type: 'string', nullable: true },
                    }},
                    providers: { type: 'array', items: { type: 'string', enum: ['google', 'spotify'] }, example: ['google', 'spotify'] },
                  },
                },
                example: {
                  user: { name: '홍길동', email: 'user@example.com', image: 'https://...' },
                  providers: ['google', 'spotify'],
                },
              }},
            },
            401: E401,
          },
        },
      },
      '/api/admin/songs': {
        get: {
          summary: '전체 곡 목록 (페이지네이션)',
          description: 'DB에 저장된 전체 곡을 최신순으로 반환합니다. ADMIN 역할 필요.',
          tags: ['Admin'],
          security: [{ sessionCookie: [] }],
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1, minimum: 1 }, description: '페이지 번호' },
            { in: 'query', name: 'size', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }, description: '페이지 크기' },
          ],
          responses: {
            200: {
              description: '페이지네이션된 곡 목록',
              content: { 'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Song' } },
                    pagination: { $ref: '#/components/schemas/Pagination' },
                  },
                },
                example: {
                  data: [{ id: 'a1b2...', genius_id: '3039923', title: 'HUMBLE.', artist: 'Kendrick Lamar', image_url: null, lyrics_status: 'DONE' }],
                  pagination: { page: 1, size: 20, total: 142, totalPages: 8 },
                },
              }},
            },
            401: E401,
            403: E403,
          },
        },
      },
      '/api/admin/songs/{id}': {
        delete: {
          summary: '곡 삭제',
          description: '곡과 연관된 모든 데이터(가사, 원문, 검색 기록 등)를 삭제합니다. ADMIN 전용.',
          tags: ['Admin'],
          security: [{ sessionCookie: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            204: { description: '삭제 성공 (본문 없음)' },
            401: E401,
            403: E403,
            404: E404('곡'),
          },
        },
      },
      '/api/admin/songs/{id}/reset': {
        post: {
          summary: '가사 생성 상태 초기화',
          description: '가사 상태를 `NONE`으로 리셋합니다. 생성 실패/교착 상태 후 재시도 시 사용.',
          tags: ['Admin'],
          security: [{ sessionCookie: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: {
              description: '초기화 성공',
              content: { 'application/json': { example: { message: 'reset' } } },
            },
            401: E401,
            403: E403,
            404: E404('곡'),
          },
        },
      },
    },
  }

  return Response.json(spec)
}
