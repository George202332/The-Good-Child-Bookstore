/**
 * Makes the 3D print mockups for books that are already published, and tells you how many were made, were already up to date,
 * or could not be made (with the reason). Safe to run again: a picture that is already up to date is skipped.
 * Run it with DATABASE_URL set in your own terminal to the database you want:
 *   npx tsx scripts/generate-print-mockups.ts
 */
import { prisma } from "../lib/prisma";
import { ensurePrintMockups } from "../lib/mockup/store";

async function main() {
  const books = await prisma.book.findMany({ where: { status: "PUBLISHED", hasPrint: true }, select: { id: true, title: true } });
  console.log(`${books.length} published print book record(s).`);
  const totals = { made: 0, kept: 0, none: 0, failed: 0 };
  for (const b of books) {
    const r = await ensurePrintMockups(b.id, { retryFailed: true });
    for (const f of ["paperback", "hardcover"] as const) totals[r[f]] += 1;
    const why = Object.entries(r.reasons).map(([f, reason]) => `${f}: ${reason}`).join(" | ");
    console.log(`${b.title}: paperback ${r.paperback}, hardcover ${r.hardcover}${why ? `  (${why})` : ""}`);
  }
  console.log(`\nDone. Made now: ${totals.made}. Already up to date: ${totals.kept}. Not offered: ${totals.none}. Could not be made: ${totals.failed}.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
