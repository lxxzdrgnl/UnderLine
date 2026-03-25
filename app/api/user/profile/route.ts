import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireSession(request)
  if (error) return error

  const body = await request.json()
  const updateData: Record<string, unknown> = {}

  if ('name' in body) {
    const name = body.name
    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 20) {
      return Response.json({ error: 'invalid name' }, { status: 422 })
    }
    updateData.name = name.trim()
  }

  if ('image' in body) {
    updateData.image = typeof body.image === 'string' ? body.image : null
  }

  if (Object.keys(updateData).length === 0) {
    return Response.json({ error: 'nothing to update' }, { status: 422 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  })

  return Response.json({ ok: true })
}
