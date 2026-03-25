import { GET } from '@/app/api/admin/songs/route'
import { NextRequest } from 'next/server'
import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    song: { findMany: vi.fn(), count: vi.fn() },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/admin/songs', () => {
  test('returns 401 when not logged in', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/admin/songs')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  test('returns 403 for ROLE_USER', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: '1', role: 'ROLE_USER' } } as never)
    const req = new NextRequest('http://localhost/api/admin/songs')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  test('returns paginated songs for ROLE_ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: '1', role: 'ROLE_ADMIN' } } as never)
    vi.mocked(prisma.song.findMany).mockResolvedValue([])
    vi.mocked(prisma.song.count).mockResolvedValue(0)
    const req = new NextRequest('http://localhost/api/admin/songs')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ data: [], pagination: { page: 1, size: 20, total: 0 } })
  })
})
