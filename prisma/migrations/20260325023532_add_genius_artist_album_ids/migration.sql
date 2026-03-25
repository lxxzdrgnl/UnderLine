-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "genius_album_id" TEXT,
ADD COLUMN     "genius_artist_id" TEXT;

-- CreateIndex
CREATE INDEX "Song_genius_artist_id_idx" ON "Song"("genius_artist_id");

-- CreateIndex
CREATE INDEX "Song_genius_album_id_idx" ON "Song"("genius_album_id");
