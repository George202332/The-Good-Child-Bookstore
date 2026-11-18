-- Departments, book references on messages, and once-only order updates. ADDITIVE ONLY: new empty columns and new tables.
-- No row is changed, no column or table is removed.

-- Messages: the book a message is about (title and SN saved with it) and the staff status New / In Progress / Resolved.
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "bookId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "bookTitle" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "bookSn" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "workflowStatus" TEXT NOT NULL DEFAULT 'NEW';
CREATE INDEX IF NOT EXISTS "Message_department_createdAt_idx" ON "Message"("department", "createdAt");

-- Which departments a staff member belongs to (a person can hold several).
CREATE TABLE IF NOT EXISTS "StaffDepartment" (
  "userId" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffDepartment_pkey" PRIMARY KEY ("userId", "department")
);

-- One row per order update sent to the buyer, so each update goes out once even if Lulu repeats itself.
CREATE TABLE IF NOT EXISTS "OrderUpdateSent" (
  "orderId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderUpdateSent_pkey" PRIMARY KEY ("orderId", "kind")
);

-- When the author was last reminded about a rejected print file.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "luluReminderAt" TIMESTAMP(3);
