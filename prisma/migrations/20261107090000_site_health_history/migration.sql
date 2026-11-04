-- Site Health history and incidents (two new tables) and a flag for print orders sent to Lulu from staging. Additive only.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stagingLuluOrder" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ServiceCheck" (
  "id" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "responseMs" INTEGER,
  "error" TEXT,
  "deployment" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ServiceCheck_service_checkedAt_idx" ON "ServiceCheck"("service", "checkedAt");
CREATE INDEX IF NOT EXISTS "ServiceCheck_checkedAt_idx" ON "ServiceCheck"("checkedAt");

CREATE TABLE IF NOT EXISTS "ServiceIncident" (
  "id" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "firstError" TEXT,
  "lastError" TEXT,
  "checksFailed" INTEGER NOT NULL DEFAULT 1,
  "deployment" TEXT NOT NULL,
  CONSTRAINT "ServiceIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ServiceIncident_service_startedAt_idx" ON "ServiceIncident"("service", "startedAt");
CREATE INDEX IF NOT EXISTS "ServiceIncident_startedAt_idx" ON "ServiceIncident"("startedAt");

