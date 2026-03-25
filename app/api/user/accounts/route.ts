import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/user/accounts?provider=spotify — 연동 해제
export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: { provider: true },
  })

  return NextResponse.json({
    user: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
    providers: accounts.map((a) => a.provider),
  })
}
