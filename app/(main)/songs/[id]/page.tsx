import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { LyricsView } from '@/components/lyrics/LyricsView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SongPage({ params }: Props) {
  const { id } = await params
  const song = await prisma.song.findUnique({ where: { id } })
  if (!song) notFound()

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center gap-4">
        {song.image_url && (
          <img src={song.image_url} alt="" className="h-16 w-16 rounded-lg object-cover shadow" />
        )}
        <div>
          <h1 className="text-2xl font-bold">{song.title}</h1>
          <p className="text-zinc-500">{song.artist}</p>
        </div>
      </div>
      <div className="flex-1">
        <LyricsView songId={song.id} />
      </div>
    </div>
  )
}
