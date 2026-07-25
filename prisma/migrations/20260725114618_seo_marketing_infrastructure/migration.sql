-- AlterTable
ALTER TABLE "AuthorProfile" ADD COLUMN     "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];
