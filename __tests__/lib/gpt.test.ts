import { describe, it, expect } from 'vitest'
import { parseNdjsonLine } from '@/lib/gpt'

describe('parseNdjsonLine', () => {
  it('유효한 NDJSON 줄을 파싱한다', () => {
    const line = '{"line":1,"original":"Hello","translation":"안녕","slang":null,"explanation":null}'
    const result = parseNdjsonLine(line)

    expect(result).toEqual({
      line_number: 1,
      original: 'Hello',
      translation: '안녕',
      slang: null,
      explanation: null,
    })
  })

  it('빈 줄은 null을 반환한다', () => {
    expect(parseNdjsonLine('')).toBeNull()
    expect(parseNdjsonLine('   ')).toBeNull()
  })

  it('JSON이 아닌 줄은 null을 반환한다', () => {
    expect(parseNdjsonLine('not json')).toBeNull()
  })

  it('필수 필드가 없으면 null을 반환한다', () => {
    expect(parseNdjsonLine('{"missing":"fields"}')).toBeNull()
  })

  it('한국어 원문은 translation이 null이다', () => {
    const line = '{"line":2,"original":"안녕하세요","translation":null,"slang":null,"explanation":"인사말"}'
    const result = parseNdjsonLine(line)
    expect(result?.translation).toBeNull()
    expect(result?.explanation).toBe('인사말')
  })
})
