import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RecentsList } from './RecentsList'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function RecentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const rows = await prisma.searchHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    take: PAGE_SIZE + 1,
    select: { id: true, genius_id: true, title: true, artist: true, image_url: true, updatedAt: true },
  })

  const hasMore = rows.length > PAGE_SIZE
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows
  const nextCursor = hasMore ? items[items.length - 1].id : null

  const entries = items.map((e) => ({
    id: e.id,
    genius_id: e.genius_id,
    title: e.title,
    artist: e.artist,
    image_url: e.image_url,
    updatedAt: e.updatedAt.toISOString(),
  }))

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      <div style={{ margin: '32px 0 24px' }}>
        <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          라이브러리
        </p>
        <h1 style={{
          margin: 0,
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 'var(--text-2xl)',
          fontWeight: 400,
          color: 'var(--text)',
        }}>
          최근 검색
        </h1>
      </div>

      <RecentsList initialEntries={entries} initialCursor={nextCursor} />
    </div>
  )
}
