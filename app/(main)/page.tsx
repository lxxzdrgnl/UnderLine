import { SearchBar } from '@/components/search/SearchBar'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-12 py-20">
      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">가사의 숨겨진 의미</h1>
        <p className="text-lg text-zinc-500">한 줄 한 줄, 진짜 의미를 찾아보세요</p>
      </div>
      <SearchBar />
    </div>
  )
}
