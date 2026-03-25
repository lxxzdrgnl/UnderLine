-- CreateTable
CREATE TABLE "ArtistCache" (
    "genius_artist_id" TEXT NOT NULL,
    "description_ko" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistCache_pkey" PRIMARY KEY ("genius_artist_id")
);
