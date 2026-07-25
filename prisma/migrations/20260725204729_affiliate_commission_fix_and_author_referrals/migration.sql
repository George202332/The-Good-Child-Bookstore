-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "authorReferralAffiliateId" TEXT,
ADD COLUMN     "authorReferralShare" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "SaleLine_authorReferralAffiliateId_idx" ON "SaleLine"("authorReferralAffiliateId");

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_authorReferralAffiliateId_fkey" FOREIGN KEY ("authorReferralAffiliateId") REFERENCES "AffiliateProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
