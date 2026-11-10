-- Personal Message on printed copies. Additive only: new empty columns and one new table. No row is changed, no column is removed.
ALTER TABLE "SaleLine" ADD COLUMN IF NOT EXISTS "personalMessage" TEXT;
ALTER TABLE "SaleLine" ADD COLUMN IF NOT EXISTS "personalMessageStyle" TEXT;
ALTER TABLE "SaleLine" ADD COLUMN IF NOT EXISTS "personalMessageStatus" TEXT;
ALTER TABLE "SaleLine" ADD COLUMN IF NOT EXISTS "personalInteriorBuiltAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "personalMessageFee" DECIMAL(10,2);

CREATE TABLE IF NOT EXISTS "PersonalMessageRecord" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "saleLineId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "style" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "flagReasons" JSONB,
  "decidedById" TEXT,
  "decidedByName" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "history" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonalMessageRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PersonalMessageRecord_status_idx" ON "PersonalMessageRecord"("status");
CREATE INDEX IF NOT EXISTS "PersonalMessageRecord_orderId_idx" ON "PersonalMessageRecord"("orderId");
CREATE INDEX IF NOT EXISTS "PersonalMessageRecord_saleLineId_idx" ON "PersonalMessageRecord"("saleLineId");
