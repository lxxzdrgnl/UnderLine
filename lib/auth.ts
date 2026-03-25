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
      authorization: {
        params: {
          scope: [
            'user-read-email',
            'user-read-currently-playing',
            'user-read-playback-state',
            'user-library-read',
          ].join(' '),
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id
      session.user.role = (user as unknown as { role: string }).role as import('@/types').Role
      return session
    },
    async signIn({ account, profile }) {
      if (!account || !profile?.email) return true

      const existingUser = await prisma.user.findUnique({
        where: { email: profile.email as string },
        include: { accounts: true },
      })

      if (existingUser) {
        const alreadyLinked = existingUser.accounts.some(
          (a) => a.provider === account.provider
        )
        if (!alreadyLinked) {
          await prisma.account.create({
            data: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
            },
          })
        }
      }
      return true
    },
  },
  pages: {
    signIn: '/login',
  },
})
