-- DropForeignKey
ALTER TABLE "LyricLine" DROP CONSTRAINT "LyricLine_song_id_fkey";

-- DropForeignKey
ALTER TABLE "SongLyricsRaw" DROP CONSTRAINT "SongLyricsRaw_song_id_fkey";

-- AddForeignKey
ALTER TABLE "SongLyricsRaw" ADD CONSTRAINT "SongLyricsRaw_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyricLine" ADD CONSTRAINT "LyricLine_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
