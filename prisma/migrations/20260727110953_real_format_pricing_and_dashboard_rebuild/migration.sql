-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "audiobookPrice" DECIMAL(10,2),
ADD COLUMN     "ebookPrice" DECIMAL(10,2),
ADD COLUMN     "hardcoverPrice" DECIMAL(10,2),
ADD COLUMN     "paperbackPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "format" TEXT;
