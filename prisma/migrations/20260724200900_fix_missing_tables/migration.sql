/*
  Warnings:

  - A unique constraint covering the columns `[accountNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountNumber` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "submissionMetadata" JSONB,
ADD COLUMN     "subtitle" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountNumber" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "IdSequence" (
    "role" "Role" NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IdSequence_pkey" PRIMARY KEY ("role")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_accountNumber_key" ON "User"("accountNumber");
