import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// DELETE /api/user/accounts?provider=spotify — 연동 해제
export async function DELETE(request: NextRequest) {
  const { session, error } = await requireSession(request)
  if (error) return error

  const provider = request.nextUrl.searchParams.get('provider')
  if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

  // 최소 1개 계정은 남아있어야 로그인 가능
  const accountCount = await prisma.account.count({ where: { userId: session.user.id } })
  if (accountCount <= 1) {
    return NextResponse.json({ error: 'last_account', message: '마지막 연결 계정은 해제할 수 없어요' }, { status: 422 })
  }

  await prisma.account.deleteMany({
    where: { userId: session.user.id, provider },
  })

  return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession(request)
  if (error) return error

  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true },
    }),
    prisma.account.findMany({
      where: { userId: session.user.id },
      select: { provider: true },
    }),
  ])

  return NextResponse.json({
    user: {
      name: user?.name ?? null,
      email: user?.email ?? null,
      image: user?.image ?? null,
    },
    providers: accounts.map((a) => a.provider),
  })
}
