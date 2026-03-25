export const dynamic = 'force-dynamic'

export async function GET() {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'Under-Line API',
      version: '1.0.0',
      description: 'AI 기반 가사 해석 서비스 API. Genius에서 가사를 가져와 GPT-4o로 번역·해석·슬랭 설명을 NDJSON 스트리밍으로 제공합니다.',
    },
    tags: [
      { name: 'Songs', description: '곡 검색, 메타데이터, 가사 해석' },
      { name: 'Spotify', description: 'Spotify 연동 (현재 재생 중인 곡)' },
      { name: 'User', description: '검색 기록, 연결된 계정' },
      { name: 'Admin', description: '관리자 전용 (ADMIN 역할 필요)' },
    ],
    components: {
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            error: { type: 'object', properties: {
              code: { type: 'string', example: 'SONG_NOT_FOUND' },
              message: { type: 'string', example: 'Song not found' },
              status: { type: 'integer', example: 404 },
              path: { type: 'string', example: '/api/songs/abc123' },
            }},
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            genius_id: { type: 'string', example: '3039923' },
            title: { type: 'string', example: 'HUMBLE.' },
            artist: { type: 'string', example: 'Kendrick Lamar' },
            image_url: { type: 'string', nullable: true },
            genius_path: { type: 'string', example: '/kendrick-lamar-humble-lyrics' },
            db_id: { type: 'string', nullable: true, description: 'DB에 저장된 경우 내부 UUID' },
            lyrics_status: { type: 'string', nullable: true, enum: ['NONE', 'PROCESSING', 'DONE'] },
          },
        },
        Song: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            genius_id: { type: 'string' },
            title: { type: 'string' },
            artist: { type: 'string' },
            image_url: { type: 'string', nullable: true },
            genius_path: { type: 'string' },
            lyrics_status: { type: 'string', enum: ['NONE', 'PROCESSING', 'DONE'] },
          },
        },
        LyricLine: {
          type: 'object',
          properties: {
            line: { type: 'integer', example: 1 },
            original: { type: 'string', example: "Sit down, be humble" },
            translation: { type: 'string', example: "앉아, 겸손해져" },
            slang: { type: 'string', nullable: true, example: "be humble: 자만하지 말라는 직접적 명령" },
            explanation: { type: 'string', nullable: true, example: "Kendrick이 라이벌 래퍼들에게 보내는 경고" },
          },
        },
        NowPlayingTrack: {
          type: 'object',
          nullable: true,
          properties: {
            title: { type: 'string', example: 'HUMBLE.' },
            artist: { type: 'string', example: 'Kendrick Lamar' },
            image_url: { type: 'string', nullable: true },
            is_playing: { type: 'boolean' },
            progress_ms: { type: 'integer', example: 45000 },
            duration_ms: { type: 'integer', example: 177000 },
          },
        },
      },
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'authjs.session-token',
          description: 'Next Auth 세션 쿠키 (브라우저에서 자동 전송)',
        },
      },
    },
    paths: {
      '/api/songs/search': {
        get: {
          summary: '곡 검색',
          description: 'Genius API로 곡을 검색합니다. 결과에 DB 캐시 여부와 가사 처리 상태가 포함됩니다. 60초 인메모리 캐시 적용.',
          tags: ['Songs'],
          parameters: [{
            in: 'query', name: 'q', required: true,
            schema: { type: 'string', minLength: 2 },
            description: '검색 키워드 (2자 이상)',
            example: 'Kendrick Lamar',
          }],
          responses: {
            200: {
              description: '검색 결과 목록',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: { results: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } } },
              }}},
            },
            429: { description: '요청 한도 초과 (분당 30회)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            500: { description: 'Genius API 오류', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      '/api/songs': {
        post: {
          summary: '곡 upsert',
          description: '검색 결과에서 곡을 선택할 때 호출됩니다. Genius에서 상세 메타데이터를 가져와 DB에 저장하거나 업데이트합니다.',
          tags: ['Songs'],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['genius_id', 'title', 'artist'],
              properties: {
                genius_id: { type: 'string', example: '3039923' },
                title: { type: 'string', example: 'HUMBLE.' },
                artist: { type: 'string', example: 'Kendrick Lamar' },
                image_url: { type: 'string', nullable: true },
                genius_path: { type: 'string', example: '/kendrick-lamar-humble-lyrics' },
              },
            }}},
          },
          responses: {
            200: {
              description: '생성 또는 기존 곡 ID',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: { id: { type: 'string', format: 'uuid' } },
              }}},
            },
            500: { description: '서버 오류', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      '/api/songs/{id}': {
        get: {
          summary: '곡 메타데이터 조회',
          tags: ['Songs'],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, description: '곡 UUID' }],
          responses: {
            200: { description: '곡 메타데이터', content: { 'application/json': { schema: { $ref: '#/components/schemas/Song' } } } },
            404: { description: '곡 없음', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      '/api/songs/{id}/lyrics': {
        get: {
          summary: '가사 + 해석 스트리밍',
          description: `GPT-4o로 번역·해석·슬랭 설명을 생성해 NDJSON 스트림으로 반환합니다.
- **캐시됨**: DB에 완료된 가사가 있으면 즉시 스트리밍
- **처리 중**: 다른 요청이 생성 중이면 202 반환 → 3초 후 재시도
- **새 요청**: Genius 스크래핑 → GPT-4o 스트리밍 → DB 저장

응답 각 줄은 JSON 객체이며 \\n으로 구분됩니다 (NDJSON).`,
          tags: ['Songs'],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: {
              description: 'NDJSON 스트림 — 각 줄이 LyricLine JSON',
              content: { 'application/x-ndjson': { schema: { $ref: '#/components/schemas/LyricLine' } } },
            },
            202: { description: '다른 프로세스가 처리 중 — 3초 후 재시도', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            404: { description: '곡 없음', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            429: { description: '요청 한도 초과 (분당 5회)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      '/api/spotify/now-playing': {
        get: {
          summary: '현재 재생 중인 곡',
          description: 'Spotify 계정이 연결된 로그인 유저의 현재 재생 중인 트랙을 반환합니다.',
          tags: ['Spotify'],
          security: [{ sessionCookie: [] }],
          responses: {
            200: {
              description: '현재 재생 중인 트랙 (재생 없으면 null)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/NowPlayingTrack' } } },
            },
            401: { description: '미로그인 또는 Spotify 미연결', content: { 'application/json': { schema: { type: 'null' } } } },
          },
        },
      },
      '/api/user/search-history': {
        get: {
          summary: '최근 검색 기록 조회',
          description: '로그인 유저의 최근 검색 10개를 반환합니다. 미로그인 시 빈 배열.',
          tags: ['User'],
          security: [{ sessionCookie: [] }],
          responses: {
            200: {
              description: '최근 검색 목록',
              content: { 'application/json': { schema: {
                type: 'array',
                items: { type: 'object', properties: {
                  id: { type: 'string' },
                  genius_id: { type: 'string' },
                  title: { type: 'string' },
                  artist: { type: 'string' },
                  image_url: { type: 'string', nullable: true },
                }},
              }}},
            },
          },
        },
        post: {
          summary: '검색 기록 저장',
          description: '곡 선택 시 검색 기록에 upsert합니다. 중복이면 최신 순으로 갱신.',
          tags: ['User'],
          security: [{ sessionCookie: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              required: ['genius_id'],
              properties: {
                genius_id: { type: 'string' },
                title: { type: 'string' },
                artist: { type: 'string' },
                image_url: { type: 'string', nullable: true },
              },
            }}},
          },
          responses: {
            200: { description: '저장 성공', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
            400: { description: 'genius_id 누락', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
            401: { description: '미로그인', content: { 'application/json': { schema: { type: 'null' } } } },
          },
        },
        delete: {
          summary: '검색 기록 삭제',
          tags: ['User'],
          security: [{ sessionCookie: [] }],
          parameters: [{ in: 'query', name: 'genius_id', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: '삭제 성공', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
            400: { description: 'genius_id 누락' },
            401: { description: '미로그인' },
          },
        },
      },
      '/api/user/accounts': {
        get: {
          summary: '연결된 계정 정보',
          description: '로그인 유저의 프로필 정보와 연결된 OAuth 프로바이더 목록을 반환합니다.',
          tags: ['User'],
          security: [{ sessionCookie: [] }],
          responses: {
            200: {
              description: '유저 정보 및 연결 프로바이더',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  user: { type: 'object', properties: {
                    name: { type: 'string', nullable: true },
                    email: { type: 'string', nullable: true },
                    image: { type: 'string', nullable: true },
                  }},
                  providers: { type: 'array', items: { type: 'string', enum: ['google', 'spotify'] } },
                },
              }}},
            },
            401: { description: '미로그인', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      '/api/admin/songs': {
        get: {
          summary: '전체 곡 목록 (페이지네이션)',
          description: 'ADMIN 역할이 있는 유저만 접근 가능합니다.',
          tags: ['Admin'],
          security: [{ sessionCookie: [] }],
          parameters: [
            { in: 'query', name: 'page', schema: { type: 'integer', default: 1 }, description: '페이지 번호' },
            { in: 'query', name: 'size', schema: { type: 'integer', default: 20, maximum: 100 }, description: '페이지 크기' },
          ],
          responses: {
            200: {
              description: '페이지네이션된 곡 목록',
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/Song' } },
                  pagination: { type: 'object', properties: {
                    page: { type: 'integer' },
                    size: { type: 'integer' },
                    total: { type: 'integer' },
                    totalPages: { type: 'integer' },
                  }},
                },
              }}},
            },
            401: { description: '미로그인' },
            403: { description: 'ADMIN 권한 없음' },
          },
        },
      },
      '/api/admin/songs/{id}': {
        delete: {
          summary: '곡 삭제',
          description: '곡과 연관된 가사, 원문 등 모든 데이터를 삭제합니다. ADMIN 전용.',
          tags: ['Admin'],
          security: [{ sessionCookie: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            204: { description: '삭제 성공' },
            401: { description: '미로그인' },
            403: { description: 'ADMIN 권한 없음' },
            404: { description: '곡 없음', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
      '/api/admin/songs/{id}/reset': {
        post: {
          summary: '가사 생성 상태 초기화',
          description: '가사 상태를 NONE으로 초기화합니다. 생성 실패 후 재시도 시 사용. ADMIN 전용.',
          tags: ['Admin'],
          security: [{ sessionCookie: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: '초기화 성공', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string', example: 'reset' } } } } } },
            401: { description: '미로그인' },
            403: { description: 'ADMIN 권한 없음' },
            404: { description: '곡 없음', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          },
        },
      },
    },
  }

  return Response.json(spec)
}
