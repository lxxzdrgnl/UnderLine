import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return Response.json(null, { status: 401 })

  const { id } = await params
  const playlist = await prisma.playlist.findUnique({ where: { id } })
  if (!playlist) return Response.json(null, { status: 404 })
  if (playlist.userId !== session.user.id) return Response.json({ error: 'forbidden' }, { status: 403 })
  if (playlist.isDefault) return Response.json({ error: 'default_playlist' }, { status: 403 })

  await prisma.playlist.delete({ where: { id } })
  return Response.json({ ok: true })
}
