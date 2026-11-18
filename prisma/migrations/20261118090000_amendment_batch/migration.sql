-- Amendment batch. ADDITIVE ONLY: new empty columns. No row is changed, no column or table is removed.

-- Payouts: record the withholding tax rate/amount and the transaction cost at the moment a payout is created.
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "withholdingRate" DECIMAL(5,2);
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "withholdingTax" DECIMAL(10,2);
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "transactionCost" DECIMAL(10,2);

-- Messages: department badge, subject, thread and the "Automatic" tag.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "threadId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "automatic" BOOLEAN NOT NULL DEFAULT false;

-- Speed: the lists the account pages read on every visit.
CREATE INDEX IF NOT EXISTS "Message_recipientId_isDraft_createdAt_idx" ON "Message"("recipientId", "isDraft", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_senderId_isDraft_createdAt_idx" ON "Message"("senderId", "isDraft", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
CREATE INDEX IF NOT EXISTS "PayoutRequest_userId_requestedAt_idx" ON "PayoutRequest"("userId", "requestedAt");

-- Speed: indexes on columns the account pages look rows up by (they had none).
CREATE INDEX IF NOT EXISTS "AffiliateLink_affiliateId_idx" ON "AffiliateLink"("affiliateId");
CREATE INDEX IF NOT EXISTS "AffiliateLink_bookId_idx" ON "AffiliateLink"("bookId");
CREATE INDEX IF NOT EXISTS "AffiliateLink_campaignId_idx" ON "AffiliateLink"("campaignId");
CREATE INDEX IF NOT EXISTS "AffiliateClick_affiliateLinkId_idx" ON "AffiliateClick"("affiliateLinkId");
CREATE INDEX IF NOT EXISTS "Campaign_affiliateId_idx" ON "Campaign"("affiliateId");
CREATE INDEX IF NOT EXISTS "WiseRecipient_userId_idx" ON "WiseRecipient"("userId");
CREATE INDEX IF NOT EXISTS "Address_readerId_idx" ON "Address"("readerId");
CREATE INDEX IF NOT EXISTS "BookFile_bookId_idx" ON "BookFile"("bookId");
