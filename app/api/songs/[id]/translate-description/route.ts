import { prisma } from '@/lib/prisma'
import { translateText } from '@/lib/gpt'

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params

  const song = await prisma.song.findFirst({
    where: { OR: [{ id }, { genius_id: id }] },
    select: { id: true, description: true, description_ko: true },
  })

  if (!song?.description || song.description === '?') {
    return Response.json({ error: 'no description' }, { status: 404 })
  }

  // Return cached translation immediately
  if (song.description_ko) {
    return Response.json({ translated: song.description_ko })
  }

  // Check if already Korean (no translation needed)
  const koreanRatio = (song.description.match(/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/g) ?? []).length / song.description.length
  if (koreanRatio > 0.1) {
    return Response.json({ translated: song.description })
  }

  // Translate and cache
  const translated = await translateText(song.description)
  await prisma.song.update({
    where: { id: song.id },
    data: { description_ko: translated },
  })

  return Response.json({ translated })
}
