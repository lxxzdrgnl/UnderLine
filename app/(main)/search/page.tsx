import { auth } from '@/lib/auth'
import { Suspense } from 'react'
import { SearchPageContent } from './SearchPageContent'

export default async function SearchPage() {
  const session = await auth()
  return (
    <Suspense>
      <SearchPageContent isLoggedIn={!!session?.user?.id} />
    </Suspense>
  )
}
