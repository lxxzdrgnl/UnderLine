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

export function withAdmin<C>(
  handler: (req: NextRequest, ctx: C) => Promise<Response>
): (req: NextRequest, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    const guard = await requireAdmin(req)
    if (guard) return guard
    return handler(req, ctx)
  }
}
