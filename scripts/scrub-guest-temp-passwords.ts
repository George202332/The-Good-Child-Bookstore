/**
 * Older guest checkouts stored the emailed temporary password in plain text on
 * the order (Order.guestTempPassword) until the confirmation email went out.
 * The new purchase email never uses it, and nothing reads it any more, so any
 * value still sitting in the database is just a leftover secret.
 *
 * DEFAULT = READ-ONLY REPORT: how many orders still hold one (never the values).
 * Usage (PowerShell, from the bookstore folder):
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/scrub-guest-temp-passwords.ts
 * ONLY AFTER YOU HAVE APPROVED, to blank them:
 *   npx tsx scripts/scrub-guest-temp-passwords.ts --apply
 * --apply changes nothing except setting that one column to empty.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const rows = await prisma.order.findMany({
    where: { guestTempPassword: { not: null } },
    select: { id: true, status: true, createdAt: true, reader: { select: { user: { select: { accountNumber: true, email: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Orders still holding a stored temporary password: ${rows.length}`);
  for (const r of rows) {
    console.log(`  order ${r.id.slice(0, 8).toUpperCase()}  ${r.status}  ${r.createdAt.toISOString().slice(0, 10)}  account ${r.reader.user.accountNumber}  ${r.reader.user.email}`);
  }
  if (!APPLY) {
    console.log("\nNothing was changed. (Run with --apply only after you have approved this.)");
    return;
  }
  const res = await prisma.order.updateMany({ where: { guestTempPassword: { not: null } }, data: { guestTempPassword: null } });
  console.log(`\nCleared ${res.count} stored temporary password(s).`);
}

main()
  .catch((e) => {
    console.error("Failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
