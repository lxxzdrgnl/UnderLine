import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

const LIMITS: Record<string, { limit: number; windowMs: number }> = {
  '/api/songs/search':      { limit: 30, windowMs: 60_000 },
  '/api/songs/[id]/lyrics': { limit: 5,  windowMs: 60_000 },
  default:                  { limit: 60, windowMs: 60_000 },
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/api/')) return NextResponse.next()
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

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
