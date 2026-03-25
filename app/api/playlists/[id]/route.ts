import { NextRequest } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req)
  if (error) return error

  const { id } = await params
  const playlist = await prisma.playlist.findUnique({ where: { id } })
  if (!playlist) return Response.json(null, { status: 404 })
  if (playlist.userId !== session.user.id) return Response.json({ error: 'forbidden' }, { status: 403 })
  if (playlist.isDefault) return Response.json({ error: 'default_playlist' }, { status: 403 })

  await prisma.playlist.delete({ where: { id } })
  return Response.json({ ok: true })
}
