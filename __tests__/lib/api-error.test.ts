import { apiError } from '@/lib/api-error'
import { describe, test, expect } from 'vitest'

describe('apiError', () => {
  test('shapes response correctly', () => {
    const result = apiError('/api/test', 404, 'SONG_NOT_FOUND')
    expect(result).toMatchObject({
      path: '/api/test',
      status: 404,
      code: 'SONG_NOT_FOUND',
      message: 'SONG_NOT_FOUND',
      details: null,
    })
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('accepts custom message and details', () => {
    const result = apiError('/api/test', 400, 'BAD_REQUEST', 'q is required', { field: 'q' })
    expect(result.message).toBe('q is required')
    expect(result.details).toEqual({ field: 'q' })
  })
})
