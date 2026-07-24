-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "hasAudiobook" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasEbook" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasPrint" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UploadedImage" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedImage_pkey" PRIMARY KEY ("id")
);
