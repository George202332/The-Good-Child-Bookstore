/**
 * Round 46 - READ-ONLY REPORT. It changes NOTHING in the database.
 *
 * Shows:
 *   PART 1 (Amendment 2): books that may have lost an eBook price or listing because of
 *     the old print-publishing bug:
 *       a) books marked as having an eBook but with NO eBook price;
 *       b) books NOT marked as having an eBook although they hold a non-print manuscript file;
 *       c) books marked as print whose Paperback AND Hardcover prices are both empty.
 *   PART 2 (Amendment 6): records that the new screens now show as ONE book (same author,
 *     same title, different formats). Nothing is merged in the database; this is display only.
 *
 * Usage (PowerShell, from the bookstore folder):
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/report-format-books.ts
 *
 * Nothing is restored or merged until you have read this and approved it.
 */
import { PrismaClient } from "@prisma/client";
import { splitTitles } from "../lib/book-groups";

const prisma = new PrismaClient();

const fmt = (b: { id: string; title: string; status: string }) => `${b.title}  [${b.status}]  id=${b.id}`;

async function main() {
  const books = await prisma.book.findMany({
    where: { deletedByAuthorAt: null },
    select: {
      id: true, title: true, status: true, authorId: true, createdAt: true,
      hasEbook: true, hasPrint: true, hasAudiobook: true,
      ebookPrice: true, paperbackPrice: true, hardcoverPrice: true, audiobookPrice: true,
      files: { select: { kind: true, url: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Books checked: ${books.length}\n`);

  console.log("PART 1a - marked as eBook but NO eBook price:");
  const a = books.filter((b) => b.hasEbook && b.ebookPrice === null);
  a.forEach((b) => console.log("  - " + fmt(b)));
  if (a.length === 0) console.log("  (none)");

  console.log("\nPART 1b - NOT marked as eBook but hold a manuscript file and no print flag:");
  const bb = books.filter((b) => !b.hasEbook && !b.hasPrint && b.files.some((f) => f.kind === "MANUSCRIPT"));
  bb.forEach((b) => console.log("  - " + fmt(b)));
  if (bb.length === 0) console.log("  (none)");

  console.log("\nPART 1c - marked as print but both print prices empty:");
  const c = books.filter((b) => b.hasPrint && b.paperbackPrice === null && b.hardcoverPrice === null);
  c.forEach((b) => console.log("  - " + fmt(b) + (b.hasEbook ? "  (combined record with eBook)" : "")));
  if (c.length === 0) console.log("  (none)");

  console.log("\nPART 2 - records now shown together as one book (display only):");
  const groups = splitTitles(books);
  for (const g of groups) {
    console.log(`  "${g[0].title}" (author ${g[0].authorId}) -> ${g.length} records:`);
    g.forEach((r) => console.log(`      ${r.id}  [${r.status}]  ${[r.hasEbook && "eBook", r.hasPrint && "Print", r.hasAudiobook && "Audiobook"].filter(Boolean).join("+")}`));
  }
  if (groups.length === 0) console.log("  (none)");

  console.log("\nNothing was changed.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
