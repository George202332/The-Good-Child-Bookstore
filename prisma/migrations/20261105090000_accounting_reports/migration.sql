-- Saved copies of the monthly accounting reports (the "Reports" list on the Accounting tab). Additive only: one new table.
CREATE TABLE IF NOT EXISTS "AccountingReport" (
  "id" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentTo" INTEGER NOT NULL DEFAULT 0,
  "testData" BOOLEAN NOT NULL DEFAULT false,
  "fileName" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  CONSTRAINT "AccountingReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountingReport_monthKey_sentAt_idx" ON "AccountingReport"("monthKey", "sentAt");
