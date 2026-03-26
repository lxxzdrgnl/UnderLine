import { NextRequest } from 'next/server'
import { fetchArtistInfo } from '@/lib/genius'
import { translateText } from '@/lib/gpt'
import { prisma } from '@/lib/prisma'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params

  const cached = await prisma.artistCache.findUnique({ where: { genius_artist_id: id } })
  if (cached?.description_ko) {
    return Response.json({ bio: cached.description_ko })
  }

  return Response.json({ bio: null })
}

// Called when user clicks "더보기" — translates only the remaining suffix
export async function POST(req: NextRequest, { params }: Props) {
  const { id } = await params
  const { offset, preview } = await req.json() as { offset: number; preview: string }

  const artist = await fetchArtistInfo(id)
  if (!artist?.description) return Response.json({ suffix: null })

  const restText = artist.description.slice(offset).trim()
  if (!restText) return Response.json({ suffix: null })

  const suffixKo = await translateText(restText)

  // Cache the full combined translation so next visit doesn't need lazy load
  const fullKo = preview + ' ' + suffixKo
  await prisma.artistCache.upsert({
    where: { genius_artist_id: id },
    create: { genius_artist_id: id, description_ko: fullKo },
    update: { description_ko: fullKo },
  })

  return Response.json({ suffix: suffixKo })
}
