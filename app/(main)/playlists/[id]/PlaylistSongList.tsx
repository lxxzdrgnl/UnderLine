'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

interface PlaylistSong {
  playlistSongId: string
  songId: string
  geniusId: string
  title: string
  artist: string
  imageUrl: string | null
  addedAt: string
}

interface Props {
  playlistId: string
  initialSongs: PlaylistSong[]
}

export function PlaylistSongList({ playlistId, initialSongs }: Props) {
  const [songs, setSongs] = useState<PlaylistSong[]>(initialSongs)
  const dragIndexRef = useRef<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function handleDragStart(index: number) {
    dragIndexRef.current = index
    setDraggingIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setOverIndex(index)
  }

  async function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault()
    const fromIndex = dragIndexRef.current
    if (fromIndex === null || fromIndex === dropIndex) {
      setDraggingIndex(null)
      setOverIndex(null)
      return
    }

    const reordered = [...songs]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(dropIndex, 0, moved)
    setSongs(reordered)
    setDraggingIndex(null)
    setOverIndex(null)
    dragIndexRef.current = null

    const order = reordered.map((s) => s.songId)
    await fetch(`/api/playlists/${playlistId}/songs/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    })
  }

  function handleDragEnd() {
    setDraggingIndex(null)
    setOverIndex(null)
    dragIndexRef.current = null
  }

  async function handleRemove(playlistSongId: string, songId: string) {
    setSongs((prev) => prev.filter((s) => s.playlistSongId !== playlistSongId))
    const res = await fetch(`/api/playlists/${playlistId}/songs/${songId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      setSongs(songs)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {songs.map((song, index) => (
        <div
          key={song.playlistSongId}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className="hover-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 12px',
            borderRadius: 'var(--r-md)',
            opacity: draggingIndex === index ? 0.4 : 1,
            background: overIndex === index && draggingIndex !== index ? 'var(--bg-subtle)' : undefined,
            transition: 'opacity 150ms var(--ease)',
            cursor: 'default',
          }}
        >
          {/* Drag handle */}
          <span
            style={{
              color: 'var(--text-faint)',
              fontSize: '18px',
              cursor: 'grab',
              userSelect: 'none',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ⠿
          </span>

          {/* Thumbnail */}
          <Link href={`/songs/${song.geniusId}`} style={{ flexShrink: 0 }}>
            {song.imageUrl ? (
              <img
                src={song.imageUrl}
                alt={song.title}
                width={44}
                height={44}
                style={{ borderRadius: 'var(--r-sm)', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--bg-subtle)',
                  flexShrink: 0,
                }}
              />
            )}
          </Link>

          {/* Title + artist */}
          <Link
            href={`/songs/${song.geniusId}`}
            style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
          >
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {song.title}
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '2px',
              }}
            >
              {song.artist}
            </div>
          </Link>

          {/* Remove button */}
          <button
            onClick={() => handleRemove(song.playlistSongId, song.songId)}
            style={{
              padding: '4px 10px',
              fontSize: 'var(--text-xs)',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              color: 'var(--text-faint)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            className="hover-row"
          >
            제거
          </button>
        </div>
      ))}
    </div>
  )
}
