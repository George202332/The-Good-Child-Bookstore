-- CreateTable
CREATE TABLE "SaleLineRoyaltyLog" (
    "id" TEXT NOT NULL,
    "saleLineId" TEXT NOT NULL,
    "orderId" TEXT,
    "bookId" TEXT,
    "previousPrintingCost" DECIMAL(10,2),
    "previousCompanyShare" DECIMAL(10,2) NOT NULL,
    "previousAuthorShare" DECIMAL(10,2) NOT NULL,
    "previousAffiliateShare" DECIMAL(10,2) NOT NULL,
    "previousAuthorReferralShare" DECIMAL(10,2) NOT NULL,
    "newPrintingCost" DECIMAL(10,2) NOT NULL,
    "newCompanyShare" DECIMAL(10,2) NOT NULL,
    "newAuthorShare" DECIMAL(10,2) NOT NULL,
    "newAffiliateShare" DECIMAL(10,2) NOT NULL,
    "newAuthorReferralShare" DECIMAL(10,2) NOT NULL,
    "costSource" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleLineRoyaltyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleLineRoyaltyLog_saleLineId_idx" ON "SaleLineRoyaltyLog"("saleLineId");

-- CreateIndex
CREATE INDEX "SaleLineRoyaltyLog_createdAt_idx" ON "SaleLineRoyaltyLog"("createdAt");
