import { describe, it, expect } from 'vitest'
import { parseRawLyrics } from '@/lib/scraper'

describe('parseRawLyrics', () => {
  it('data-lyrics-container div에서 텍스트를 추출한다', () => {
    const html = `
      <html><body>
        <div data-lyrics-container="true">
          Sit down<br/>I'll pour the wine<br/>
          <a href="#">Talk all night</a>
        </div>
      </body></html>
    `
    const result = parseRawLyrics(html)
    expect(result).toContain("Sit down")
    expect(result).toContain("I'll pour the wine")
    expect(result).toContain("Talk all night")
  })

  it('[Verse], [Chorus] 섹션 태그를 보존한다', () => {
    const html = `
      <div data-lyrics-container="true">
        [Verse 1]<br/>Line one<br/>[Chorus]<br/>Line two
      </div>
    `
    const result = parseRawLyrics(html)
    expect(result).toContain('[Verse 1]')
    expect(result).toContain('[Chorus]')
    expect(result).toContain('Line one')
  })

  it('가사 컨테이너가 없으면 빈 문자열을 반환한다', () => {
    const html = '<html><body><p>No lyrics here</p></body></html>'
    expect(parseRawLyrics(html)).toBe('')
  })
})
