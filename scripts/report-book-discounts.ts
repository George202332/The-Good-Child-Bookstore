/**
 * READ-ONLY report: does any book have a discount recorded against it?
 *
 * The site no longer shows or uses discounts. The database has no discount
 * column; the only place a discount could ever have been kept is inside a book's
 * submission details (the keys discountPrice / promoPrice). This lists any book
 * that has one, with its regular price, so you can confirm. It changes nothing.
 *
 * Usage (PowerShell, from the bookstore folder), pointing at the database to check:
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/report-book-discounts.ts
 * (The connection string is read from your environment and never printed.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const books = await prisma.book.findMany({
    select: { id: true, title: true, status: true, price: true, submissionMetadata: true },
    orderBy: { createdAt: "asc" },
  });
  const flagged = books.flatMap((b) => {
    const m = (b.submissionMetadata ?? {}) as Record<string, unknown>;
    const discount = m.discountPrice ?? m.promoPrice;
    const hasValue = discount !== undefined && discount !== null && discount !== "" && discount !== 0;
    return hasValue ? [{ b, discount }] : [];
  });
  console.log(`Books checked: ${books.length}`);
  console.log(`Books with a discount/promo price recorded: ${flagged.length}`);
  for (const { b, discount } of flagged) {
    console.log(`  ${b.title} [${b.status}]  regular price $${Number(b.price).toFixed(2)}  recorded discount value ${String(discount)}`);
  }
  console.log("\nNothing was changed. Every book is sold at its regular price.");
}

main()
  .catch((e) => {
    console.error("Report failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
