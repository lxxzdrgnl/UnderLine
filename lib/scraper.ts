import { execFile } from 'node:child_process'
import * as cheerio from 'cheerio'
import { logger } from '@/lib/logger'

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

// Genius' Cloudflare serves a JS challenge (403, cf-mitigated: challenge) to
// Node fetch from the home server's IP, but lets BusyBox wget (present in the
// node:alpine runtime image) through. Try fetch first, fall back to wget.
function fetchWithWget(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'wget',
      ['-q', '-T', '20', '-O', '-', url],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    )
  })
}

export async function scrapeLyrics(geniusPath: string): Promise<string> {
  const url = `https://genius.com${geniusPath}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })

  if (res.ok) return parseRawLyrics(await res.text())

  logger.warn('scraper: fetch blocked, retrying with wget', { status: res.status, url })
  let html: string
  try {
    html = await fetchWithWget(url)
  } catch (e) {
    throw new Error(
      `Scraping failed: fetch ${res.status}, wget ${e instanceof Error ? e.message : e} for ${url}`,
    )
  }
  return parseRawLyrics(html)
}
