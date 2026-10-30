/**
 * Round 51 - READ-ONLY REPORT. It changes NOTHING in the database.
 *
 * The Co-Authors, Illustrator, Editor and Translator boxes were removed from the forms, and those
 * names are no longer shown anywhere. This counts the books that still have such names saved, so you can
 * decide whether to delete the stored text (nothing is deleted until you approve).
 *
 * Usage (PowerShell, from the bookstore folder):
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/report-contributors.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KEYS = ["coAuthors", "illustrator", "editor", "translator"] as const;

async function main() {
  const books = await prisma.book.findMany({ select: { id: true, title: true, submissionMetadata: true } });
  const counts: Record<string, number> = { coAuthors: 0, illustrator: 0, editor: 0, translator: 0 };
  const affected: { id: string; title: string; keys: string[] }[] = [];
  for (const b of books) {
    const meta = (b.submissionMetadata as Record<string, unknown> | null) ?? {};
    const keys = KEYS.filter((k) => typeof meta[k] === "string" && (meta[k] as string).trim() !== "");
    for (const k of keys) counts[k]++;
    if (keys.length) affected.push({ id: b.id, title: b.title, keys });
  }
  console.log(`Book records: ${books.length}; with at least one contributor name saved: ${affected.length}`);
  console.log(`Co-authors: ${counts.coAuthors}; Illustrators: ${counts.illustrator}; Editors: ${counts.editor}; Translators: ${counts.translator}`);
  for (const a of affected) console.log(`- ${a.title} (${a.id}): ${a.keys.join(", ")}`);
  console.log("\nNothing was changed. These names are hidden everywhere on the site; only the stored text remains.");
}
main().finally(() => prisma.$disconnect());
