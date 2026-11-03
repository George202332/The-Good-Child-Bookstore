-- Catch-up migration. Earlier rounds changed the data model with "prisma db push", so these changes never had a migration file.
-- Every statement is additive and guarded (IF NOT EXISTS), so it is safe on a database that already has some or all of it.
-- It only ADDS tables, columns, indexes, relations and enum values. It never drops, renames or rewrites anything.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CHIEF_EDITOR';

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INVESTOR';

ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

ALTER TYPE "ContentStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';

ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isTestData" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "guestSetupPending" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastViewedRevenueAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "OrderLoginToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'ACCOUNT',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SignupAttempt" (
  "id" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignupAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContactAttempt" (
  "id" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TwoFactorConfig" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "method" TEXT,
  "phoneNumber" TEXT,
  "pendingMethod" TEXT,
  "pendingPhoneNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TwoFactorConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TwoFactorChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "fontFamily" TEXT NOT NULL DEFAULT 'default';

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "fontSize" TEXT NOT NULL DEFAULT 'default';

ALTER TABLE "AuthorProfile" ADD COLUMN IF NOT EXISTS "country" TEXT;

ALTER TABLE "AuthorProfile" ADD COLUMN IF NOT EXISTS "gender" TEXT;

CREATE TABLE IF NOT EXISTS "AuthorAlias" (
  "id" TEXT NOT NULL,
  "authorProfileId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuthorPublisher" (
  "id" TEXT NOT NULL,
  "authorProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorPublisher_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuthorNameFollow" (
  "id" TEXT NOT NULL,
  "readerId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorNameFollow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "isTestData" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "pendingRevisionData" JSONB;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "coverAltText" TEXT;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "category" TEXT;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "restrictedCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "revisionNotes" TEXT;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "pendingAction" TEXT;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "pendingActionBy" TEXT;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "pendingActionNote" TEXT;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "reviewChecklist" JSONB;

ALTER TABLE "Book" ADD COLUMN IF NOT EXISTS "deletedByAuthorAt" TIMESTAMP(3);

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "imageAltText" TEXT;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "authorFirstName" TEXT;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "authorLastName" TEXT;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "shortSummary" TEXT;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "seoKeywords" TEXT;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "allowComments" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Blog" ADD COLUMN IF NOT EXISTS "revisionNotes" TEXT;

CREATE TABLE IF NOT EXISTS "BlogRead" (
  "id" TEXT NOT NULL,
  "blogId" TEXT NOT NULL,
  "country" TEXT,
  "region" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlogRead_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isTestData" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestTempPassword" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "purchaseEmailSentAt" TIMESTAMP(3);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "country" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "region" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipName" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipPhone" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipCountry" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipAddress" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingLevel" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingAmount" DECIMAL(10,2);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "printJobStatus" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "printJobId" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "printJobError" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluShippingCost" DECIMAL(10,2);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluFulfillmentCost" DECIMAL(10,2);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluStatus" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluStatusAt" TIMESTAMP(3);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluShippedAt" TIMESTAMP(3);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluActualProduction" DECIMAL(10,2);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluActualShipping" DECIMAL(10,2);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluActualFulfillment" DECIMAL(10,2);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluSyncedAt" TIMESTAMP(3);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluRejectionReason" TEXT;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluRejectedAt" TIMESTAMP(3);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluAuthorNotifiedAt" TIMESTAMP(3);

ALTER TABLE "SaleLine" ADD COLUMN IF NOT EXISTS "printingCost" DECIMAL(10,2);

ALTER TABLE "AffiliateClick" ADD COLUMN IF NOT EXISTS "region" TEXT;

ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "earningsType" TEXT NOT NULL DEFAULT 'AUTHOR';

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'GENERAL';

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "relatedRecordId" TEXT;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isDraft" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "category" TEXT;

CREATE TABLE IF NOT EXISTS "Redirect" (
  "id" TEXT NOT NULL,
  "fromPath" TEXT NOT NULL,
  "toPath" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL DEFAULT 301,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IndexNowSubmission" (
  "id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "statusCode" INTEGER,
  "ok" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IndexNowSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SystemErrorLog" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "context" JSONB,
  "alertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PrintPreflightCheck" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookId" TEXT,
  "interiorFileId" TEXT NOT NULL,
  "coverKey" TEXT NOT NULL,
  "packageIds" TEXT NOT NULL,
  "pageCount" INTEGER,
  "status" TEXT NOT NULL,
  "siteIssues" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "luluJobs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "reasons" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "luluEnvironment" TEXT,
  "coverWrapFileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "PrintPreflightCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderLoginToken_tokenHash_key" ON "OrderLoginToken"("tokenHash");

CREATE INDEX IF NOT EXISTS "OrderLoginToken_userId_idx" ON "OrderLoginToken"("userId");

CREATE INDEX IF NOT EXISTS "OrderLoginToken_orderId_idx" ON "OrderLoginToken"("orderId");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");

CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

CREATE INDEX IF NOT EXISTS "SignupAttempt_ip_createdAt_idx" ON "SignupAttempt"("ip", "createdAt");

CREATE INDEX IF NOT EXISTS "ContactAttempt_ip_createdAt_idx" ON "ContactAttempt"("ip", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "TwoFactorConfig_userId_key" ON "TwoFactorConfig"("userId");

CREATE INDEX IF NOT EXISTS "TwoFactorChallenge_userId_purpose_idx" ON "TwoFactorChallenge"("userId", "purpose");

CREATE UNIQUE INDEX IF NOT EXISTS "AuthorAlias_authorProfileId_firstName_lastName_key" ON "AuthorAlias"("authorProfileId", "firstName", "lastName");

CREATE INDEX IF NOT EXISTS "AuthorAlias_authorProfileId_idx" ON "AuthorAlias"("authorProfileId");

CREATE UNIQUE INDEX IF NOT EXISTS "AuthorPublisher_authorProfileId_name_key" ON "AuthorPublisher"("authorProfileId", "name");

CREATE INDEX IF NOT EXISTS "AuthorPublisher_authorProfileId_idx" ON "AuthorPublisher"("authorProfileId");

CREATE UNIQUE INDEX IF NOT EXISTS "AuthorNameFollow_readerId_authorName_key" ON "AuthorNameFollow"("readerId", "authorName");

CREATE INDEX IF NOT EXISTS "AuthorNameFollow_authorName_idx" ON "AuthorNameFollow"("authorName");

CREATE UNIQUE INDEX IF NOT EXISTS "Book_isbn_key" ON "Book"("isbn");

CREATE INDEX IF NOT EXISTS "Blog_authorId_idx" ON "Blog"("authorId");

CREATE INDEX IF NOT EXISTS "BlogRead_blogId_idx" ON "BlogRead"("blogId");

CREATE INDEX IF NOT EXISTS "BlogComment_blogId_idx" ON "BlogComment"("blogId");

CREATE INDEX IF NOT EXISTS "BlogComment_userId_idx" ON "BlogComment"("userId");

CREATE INDEX IF NOT EXISTS "Review_bookId_idx" ON "Review"("bookId");

CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON "Review"("userId");

CREATE INDEX IF NOT EXISTS "Order_readerId_idx" ON "Order"("readerId");

CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");

CREATE INDEX IF NOT EXISTS "PayoutRequest_userId_idx" ON "PayoutRequest"("userId");

CREATE INDEX IF NOT EXISTS "PayoutRequest_status_idx" ON "PayoutRequest"("status");

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");

CREATE INDEX IF NOT EXISTS "Notification_relatedRecordId_idx" ON "Notification"("relatedRecordId");

CREATE UNIQUE INDEX IF NOT EXISTS "Redirect_fromPath_key" ON "Redirect"("fromPath");

CREATE INDEX IF NOT EXISTS "SystemErrorLog_source_createdAt_idx" ON "SystemErrorLog"("source", "createdAt");

CREATE INDEX IF NOT EXISTS "SystemErrorLog_signature_createdAt_idx" ON "SystemErrorLog"("signature", "createdAt");

CREATE INDEX IF NOT EXISTS "PrintPreflightCheck_userId_createdAt_idx" ON "PrintPreflightCheck"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "PrintPreflightCheck_interiorFileId_idx" ON "PrintPreflightCheck"("interiorFileId");

CREATE INDEX IF NOT EXISTS "PrintPreflightCheck_bookId_idx" ON "PrintPreflightCheck"("bookId");

DO $$ BEGIN
  ALTER TABLE "OrderLoginToken" ADD CONSTRAINT "OrderLoginToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderLoginToken" ADD CONSTRAINT "OrderLoginToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TwoFactorConfig" ADD CONSTRAINT "TwoFactorConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TwoFactorChallenge" ADD CONSTRAINT "TwoFactorChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuthorAlias" ADD CONSTRAINT "AuthorAlias_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "AuthorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuthorPublisher" ADD CONSTRAINT "AuthorPublisher_authorProfileId_fkey" FOREIGN KEY ("authorProfileId") REFERENCES "AuthorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AuthorNameFollow" ADD CONSTRAINT "AuthorNameFollow_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "ReaderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BlogRead" ADD CONSTRAINT "BlogRead_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
