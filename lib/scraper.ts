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
    .filter((l) => l.length > 0)
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
  if (!raw) throw new Error('No lyrics container found on page')
  return raw
}
