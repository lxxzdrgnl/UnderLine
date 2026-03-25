import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function formatDateGroup(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diff = today.getTime() - d.getTime()
  if (diff === 0) return '오늘'
  if (diff === 86400000) return '어제'

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function RecentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const history = await prisma.searchHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  })

  const groups: Map<string, typeof history> = new Map()
  for (const entry of history) {
    const label = formatDateGroup(entry.updatedAt)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(entry)
  }

  return (
    <div className="page-enter" style={{ paddingBottom: '64px' }}>
      <h1 style={{
        margin: '32px 0 28px',
        fontFamily: "'DM Serif Display', Georgia, serif",
        fontSize: 'var(--text-2xl)',
        fontWeight: 400,
        color: 'var(--text)',
      }}>
        Recents
      </h1>

      {history.length === 0 && (
        <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '60px 0' }}>
          아직 검색 기록이 없어요
        </p>
      )}

      {Array.from(groups.entries()).map(([label, entries]) => (
        <section key={label} style={{ marginBottom: '28px' }}>
          <h2 style={{
            margin: '0 0 12px',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          }}>
            {label}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/songs/${entry.genius_id}`}
                className="hover-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '10px 12px', borderRadius: 'var(--r-md)',
                  textDecoration: 'none', transition: 'background var(--dur)',
                }}
              >
                {entry.image_url && (
                  <img src={entry.image_url} alt="" style={{ width: '44px', height: '44px', borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.title}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.artist}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
