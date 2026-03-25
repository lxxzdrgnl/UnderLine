/** Strip "(Romanized)" suffix from a Genius title or album name */
export function stripRomanized(text: string): string {
  return text.replace(/\s*\(Romanized\)\s*$/i, '').trim()
}

/** Strip "Artist - " prefix from a Genius Romanizations album name */
export function stripArtistPrefix(text: string): string {
  return text.replace(/^.+\s*[-–]\s*/, '').trim()
}

/** Clean a Genius Romanizations album name: strip artist prefix + "(Romanized)" */
export function cleanRomanizedAlbum(name: string): string {
  return stripRomanized(name.replace(/^.+\s*[-–]\s*/, '').trim())
}

/** True if this path belongs to a Genius Romanizations entry */
export function isRomanizationPath(geniusPath: string): boolean {
  return /^\/genius-romanizations-/i.test(geniusPath)
}

/** True if this artist name is the Genius Romanizations account */
export function isGeniusRomanizations(artist: string): boolean {
  return /^genius romanizations$/i.test(artist.trim())
}
