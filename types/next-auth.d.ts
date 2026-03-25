import { DefaultSession } from 'next-auth'
import { Role } from './index'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession['user']
  }
}
