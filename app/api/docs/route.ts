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
