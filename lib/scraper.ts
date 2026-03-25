import * as cheerio from 'cheerio'

export function parseRawLyrics(html: string): string {
  const $ = cheerio.load(html)
  const segments: string[] = []

  $('[data-lyrics-container="true"]').each((_, container) => {
    $(container).find('br').replaceWith('\n')
    segments.push($(container).text())
  })

  if (segments.length === 0) return ''

  return segments
    .join('\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false
      // Strip Genius page metadata that leaks into lyrics containers
      if (/Contributors/i.test(l) && /Translations/i.test(l)) return false
      if (/^\d+\s+Contributors?/i.test(l)) return false
      if (/^Translations?$/i.test(l)) return false
      if (/^Read More$/i.test(l)) return false
      // Genius song description truncated with "Read More" link
      if (/…\s*Read More\b/i.test(l)) return false
      if (/\.\.\.\s*Read More\b/i.test(l)) return false
      if (/\bLyrics$/.test(l) && l.split(/\s+/).length <= 5) return false
      // Long prose description lines before/between lyrics (e.g., Genius song descriptions)
      if (l.length > 200 && !/^\[/.test(l)) return false
      return true
    })
    .join('\n')
}

export async function scrapeLyrics(geniusPath: string): Promise<string> {
  const url = `https://genius.com${geniusPath}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })

  if (!res.ok) throw new Error(`Scraping failed: ${res.status} for ${url}`)

  const html = await res.text()
  const raw = parseRawLyrics(html)
  return raw
}
