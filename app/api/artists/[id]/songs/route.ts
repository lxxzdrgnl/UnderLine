import { NextRequest, NextResponse } from 'next/server'
import { fetchArtistSongs } from '@/lib/genius'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const page = Number(request.nextUrl.searchParams.get('page') ?? '1')
  const songs = await fetchArtistSongs(id, page)
  return NextResponse.json({ songs })
}
