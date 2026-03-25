import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  const rawCookie = req.cookies.get('authjs.session-token')?.value

  const dbSession = rawCookie
    ? await prisma.session.findUnique({ where: { sessionToken: rawCookie }, include: { user: { select: { email: true } } } })
    : null

  return NextResponse.json({
    session: session ? { id: session.user?.id, email: session.user?.email } : null,
    cookie: rawCookie ? rawCookie.slice(0, 8) + '...' : 'MISSING',
    dbSession: dbSession ? { userId: dbSession.userId, expires: dbSession.expires, userEmail: dbSession.user?.email } : null,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_URL: process.env.AUTH_URL,
  })
}
