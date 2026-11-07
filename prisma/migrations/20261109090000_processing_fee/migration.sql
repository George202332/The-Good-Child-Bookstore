-- Processing Fee on print orders. Additive only: new empty columns on "Order" and "Refund". No row is changed, no column is removed.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "processingFeeAmount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "processingFeeGateway" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "processingFeeBasis" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gatewayCostActual" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gatewayCostSource" TEXT;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "processingFeeRefunded" DECIMAL(10,2);
