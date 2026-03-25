import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireSession(request)
  if (error) return error

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
