-- Scaling: faster look-ups (indexes) and a small table that counts requests for rate limiting. Additive only: no column or row is changed or removed.
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "Book_status_createdAt_idx" ON "Book"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Blog_status_publishAt_idx" ON "Blog"("status", "publishAt");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SaleLine_orderId_idx" ON "SaleLine"("orderId");
CREATE INDEX IF NOT EXISTS "PaymentLog_orderId_idx" ON "PaymentLog"("orderId");
CREATE INDEX IF NOT EXISTS "Review_bookId_createdAt_idx" ON "Review"("bookId", "createdAt");
CREATE INDEX IF NOT EXISTS "SystemErrorLog_createdAt_idx" ON "SystemErrorLog"("createdAt");

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key", "windowStart")
);
CREATE INDEX IF NOT EXISTS "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");
