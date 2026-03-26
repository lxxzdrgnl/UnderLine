import { prisma } from '@/lib/prisma'
import { fetchSongDetail } from '@/lib/genius'
import { stripRomanized } from '@/lib/strings'
import type { GeniusSearchResult } from '@/types'

/**
 * Create or update a song record using data from a Genius search result.
 * Detail fields (album, description, etc.) are filled in on song page visit.
 */
export async function upsertSongFromSearchResult(result: GeniusSearchResult) {
  const existing = await prisma.song.findUnique({ where: { genius_id: result.genius_id } })
  if (existing) return existing

  return prisma.song.create({
    data: {
      genius_id: result.genius_id,
      title: stripRomanized(result.title),
      artist: result.artist,
      image_url: result.image_url,
      genius_path: result.genius_path,
    },
  })
}

/**
 * Find a song by CUID or Genius ID, filling in detail if missing.
 * If not in DB and a numeric Genius ID is given, fetches from Genius and creates.
 */
export async function getOrCreateSong(id: string) {
  // 1. Try by CUID or Genius ID
  let song = await prisma.song.findUnique({ where: { id } })
    ?? await prisma.song.findUnique({ where: { genius_id: id } })

  // 2. Re-fetch if missing detail, or featured_artists lacks type markers (old data)
  const featuredArr = Array.isArray(song?.featured_artists) ? song.featured_artists as Array<{ type?: string }> : []
  const needsDetail = song && (
    !song.description ||
    (featuredArr.length > 0 && featuredArr.some((fa) => !fa.type))
  )
  if (needsDetail) {
    const detail = await fetchSongDetail(song.genius_id)
    if (detail) {
      const detailData = {
        artist: detail.artist,
        album: detail.album,
        album_image_url: detail.album_image_url,
        release_date: detail.release_date,
        description: detail.description,
        spotify_url: detail.spotify_url,
        youtube_url: detail.youtube_url,
        apple_music_url: detail.apple_music_url,
        genius_artist_id: detail.genius_artist_id,
        genius_album_id: detail.genius_album_id,
        featured_artists: detail.featured_artists ?? [],
      }
      song = await prisma.song.update({
        where: { id: song.id },
        data: detailData,
      })
    }
  }
  if (song) return song

  // 3. Not in DB — numeric Genius ID → fetch detail and create
  if (/^\d+$/.test(id)) {
    const detail = await fetchSongDetail(id)
    if (!detail) return null
    const detailData = {
      artist: detail.artist,
      album: detail.album,
      album_image_url: detail.album_image_url,
      release_date: detail.release_date,
      description: detail.description,
      spotify_url: detail.spotify_url,
      youtube_url: detail.youtube_url,
      apple_music_url: detail.apple_music_url,
      genius_artist_id: detail.genius_artist_id,
      genius_album_id: detail.genius_album_id,
      featured_artists: detail.featured_artists ?? [],
    }
    return prisma.song.upsert({
      where: { genius_id: id },
      create: {
        genius_id: id,
        title: stripRomanized(detail.title),
        image_url: detail.image_url,
        genius_path: detail.genius_path,
        ...detailData,
      },
      update: detailData,
    })
  }

  return null
}
