-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- DropForeignKey
ALTER TABLE "Playlist" DROP CONSTRAINT "Playlist_layoutId_fkey";

-- DropForeignKey
ALTER TABLE "PlaylistItem" DROP CONSTRAINT "PlaylistItem_contentId_fkey";

-- DropForeignKey
ALTER TABLE "PlaylistItem" DROP CONSTRAINT "PlaylistItem_playlistId_fkey";

-- AlterTable
ALTER TABLE "Playlist" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "layoutId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlaylistItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "mediaId" TEXT,
ALTER COLUMN "contentId" DROP NOT NULL,
ALTER COLUMN "zoneId" SET DEFAULT 'main';

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" INTEGER,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "Layout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
