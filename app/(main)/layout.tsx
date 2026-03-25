import Link from 'next/link'
import { auth } from '@/lib/auth'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          under<span className="text-zinc-400">_</span>line
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/docs" className="text-zinc-400 hover:text-zinc-600">API 문서</Link>
          {session ? (
            <Link href="/profile" className="flex items-center gap-2">
              {session.user?.image && (
                <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" />
              )}
            </Link>
          ) : (
            <Link href="/login" className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-white dark:text-zinc-900">
              로그인
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  )
}
