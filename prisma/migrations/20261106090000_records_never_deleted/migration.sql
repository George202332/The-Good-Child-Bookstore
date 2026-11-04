-- 1) Records that are never deleted: refunds, payout reversals and a permanent change log (three new tables, additive),
--    plus a status on each payment row. Nothing existing is changed or removed in this step.
ALTER TABLE "PaymentLog" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'RECORDED';
ALTER TABLE "PaymentLog" ADD COLUMN IF NOT EXISTS "statusReason" TEXT;
ALTER TABLE "PaymentLog" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "Refund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "reason" TEXT NOT NULL,
  "processedById" TEXT NOT NULL,
  "processedByName" TEXT NOT NULL,
  "gatewayReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Refund_orderId_idx" ON "Refund"("orderId");
CREATE INDEX IF NOT EXISTS "Refund_createdAt_idx" ON "Refund"("createdAt");

CREATE TABLE IF NOT EXISTS "PayoutAdjustment" (
  "id" TEXT NOT NULL,
  "payoutRequestId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayoutAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PayoutAdjustment_payoutRequestId_idx" ON "PayoutAdjustment"("payoutRequestId");

CREATE TABLE IF NOT EXISTS "RecordChangeLog" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "actorId" TEXT,
  "actorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecordChangeLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RecordChangeLog_entityType_entityId_createdAt_idx" ON "RecordChangeLog"("entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "RecordChangeLog_createdAt_idx" ON "RecordChangeLog"("createdAt");

DO $$ BEGIN
  ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PayoutAdjustment" ADD CONSTRAINT "PayoutAdjustment_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "PayoutRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) A lock in the database itself: rows in these tables cannot be deleted, by the site, by a script or by hand, unless the
--    deleting session first says so with `SET LOCAL app.allow_record_delete = 'on'` inside its own transaction. Only the
--    one-time, approved test-data cleanup script does that. This also stops a cascade (deleting a user or a book) from
--    silently wiping payments, orders or payouts: such a delete is refused instead.
CREATE OR REPLACE FUNCTION gcb_block_record_delete() RETURNS trigger AS $fn$
BEGIN
  IF current_setting('app.allow_record_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Records in table "%" are never deleted (record a refund, a status or a reversing entry instead).', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$fn$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Order','SaleLine','PaymentLog','PayoutRequest','Refund','PayoutAdjustment','RecordChangeLog','SaleLineRoyaltyLog']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS gcb_no_delete ON %I', t);
    EXECUTE format('CREATE TRIGGER gcb_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION gcb_block_record_delete()', t);
  END LOOP;
END $$;

-- 3) Old stored copies of API keys are removed from the saved site settings (keys now live only in Vercel). Only the key
--    fields are removed; every other setting, and the shipping-method choice, is kept. "fromEmail" is left in place (it is not
--    a secret and is no longer read; set FROM_EMAIL in Vercel instead).
UPDATE "Setting"
SET "value" = jsonb_set(
  "value"::jsonb,
  '{apiKeys}',
  ("value"::jsonb -> 'apiKeys')
    - 'paystackSecretKey' - 'paystackPublicKey'
    - 'paypalClientId' - 'paypalClientSecret' - 'paypalEnvironment'
    - 'luluClientKey' - 'luluClientSecret' - 'luluEnvironment'
    - 'resendApiKey' - 'paymentMode'
)
WHERE "key" = 'site_settings'
  AND jsonb_typeof("value"::jsonb -> 'apiKeys') = 'object';
