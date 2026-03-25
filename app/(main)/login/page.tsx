import { signIn } from '@/lib/auth'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-4">
      <form
        action={async () => {
          'use server'
          await signIn('google', { redirectTo: '/' })
        }}
      >
        <button type="submit" className="rounded-lg bg-white px-6 py-3 font-medium shadow border">
          Google로 로그인
        </button>
      </form>
      <form
        action={async () => {
          'use server'
          await signIn('spotify', { redirectTo: '/' })
        }}
      >
        <button type="submit" className="rounded-lg bg-green-500 px-6 py-3 font-medium text-white">
          Spotify로 로그인
        </button>
      </form>
    </div>
  )
}
