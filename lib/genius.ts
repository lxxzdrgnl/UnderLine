import type { GeniusSearchResult, GeniusHit } from '@/types'

const BASE_URL = 'https://api.genius.com'

async function geniusFetch(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Genius API error: ${res.status}`)
  return res.json()
}

export async function searchSongs(query: string): Promise<GeniusSearchResult[]> {
  const params = new URLSearchParams({ q: query, per_page: '10' })
  const data = await geniusFetch(`/search?${params}`)

  return (data.response.hits as GeniusHit[])
    .filter((hit) => hit.type === 'song')
    .map((hit) => ({
      genius_id: String(hit.result.id),
      title: hit.result.title,
      artist: hit.result.artist_names,
      image_url: hit.result.song_art_image_thumbnail_url ?? null,
      genius_path: hit.result.path,
    }))
}

export async function getReferents(geniusSongId: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      song_id: geniusSongId,
      per_page: '50',
      text_format: 'plain',
    })
    const data = await geniusFetch(`/referents?${params}`)

    return (data.response.referents as Array<{
      fragment: string
      annotations: Array<{ body: { plain: string } }>
    }>)
      .map((ref) => {
        const annotation = ref.annotations?.[0]?.body?.plain ?? ''
        return `구절: "${ref.fragment}" / Genius 해설: ${annotation}`
      })
      .join('\n')
  } catch {
    return ''
  }
}
