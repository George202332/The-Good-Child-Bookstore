/**
 * Makes the 3D print mockups for books that are already published. Safe to run again: a book whose picture is
 * already up to date is skipped ("kept"). Run it against the database you want, with DATABASE_URL set in your terminal:
 *   npx tsx scripts/generate-print-mockups.ts
 */
import { prisma } from "../lib/prisma";
import { ensurePrintMockups } from "../lib/mockup/store";

async function main() {
  const books = await prisma.book.findMany({ where: { status: "PUBLISHED", hasPrint: true }, select: { id: true, title: true } });
  console.log(`${books.length} published print book(s).`);
  for (const b of books) {
    const r = await ensurePrintMockups(b.id);
    console.log(`${b.title}: paperback ${r.paperback}, hardcover ${r.hardcover}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
