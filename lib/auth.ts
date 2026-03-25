/**
 * NextAuth 설정.
 * OAuth 플로우는 /api/oauth/[provider] 에서 직접 처리.
 * NextAuth는 세션 읽기(auth())와 세션 미들웨어 역할만 담당.
 */
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Spotify from 'next-auth/providers/spotify'
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as any),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      session.user.role = (user as unknown as { role: string }).role as import('@/types').Role
      return session
    },
  },
  pages: { signIn: '/login' },
})
