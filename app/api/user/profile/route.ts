import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { name } = await request.json()
  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 20) {
    return Response.json({ error: 'invalid name' }, { status: 422 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.trim() },
  })

  return Response.json({ ok: true })
}
