import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
