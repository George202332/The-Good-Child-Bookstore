-- Accounting (Admin > Accounting). Additive only: four NEW tables. Nothing existing is changed, dropped or rewritten.
-- Guarded with IF NOT EXISTS so it is safe to run on a database that already has them.

CREATE TABLE IF NOT EXISTS "AccountingExpense" (
  "id" TEXT NOT NULL,
  "expenseDate" DATE NOT NULL,
  "monthKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "receiptFileId" TEXT,
  "receiptName" TEXT,
  "enteredById" TEXT NOT NULL,
  "enteredByName" TEXT NOT NULL,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "updatedAt" TIMESTAMP(3),
  CONSTRAINT "AccountingExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountingExpense_monthKey_idx" ON "AccountingExpense"("monthKey");

CREATE TABLE IF NOT EXISTS "AccountingMonth" (
  "monthKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "closedAt" TIMESTAMP(3),
  "closedByName" TEXT,
  "snapshot" JSONB,
  "reportVersion" INTEGER NOT NULL DEFAULT 0,
  "lastReportSentAt" TIMESTAMP(3),
  "lastReportRecipients" INTEGER,
  "reopenedAt" TIMESTAMP(3),
  "reopenedByName" TEXT,
  "reopenReason" TEXT,
  "reminderSentAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingMonth_pkey" PRIMARY KEY ("monthKey")
);

CREATE TABLE IF NOT EXISTS "AccountingChangeLog" (
  "id" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccountingChangeLog_monthKey_createdAt_idx" ON "AccountingChangeLog"("monthKey", "createdAt");

CREATE TABLE IF NOT EXISTS "AccountingReceipt" (
  "id" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "mimeType" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingReceipt_pkey" PRIMARY KEY ("id")
);
