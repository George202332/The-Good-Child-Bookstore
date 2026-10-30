/**
 * Round 49 - READ-ONLY REPORT. It changes NOTHING in the database.
 *
 * The AI use declaration is now two tick boxes (one answer per book). This lists how many books
 * hold each kind of stored declaration so you can approve how to convert the old written ones:
 *   - already one of the two statements (nothing to do)
 *   - an older written declaration (needs the author to tick a box; the old text is kept on record)
 *   - none yet
 *
 * Usage (PowerShell, from the bookstore folder):
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/report-ai-declarations.ts
 */
import { PrismaClient } from "@prisma/client";
import { aiChoiceOf, isLegacyAiText } from "../lib/ai-declaration";

const prisma = new PrismaClient();

async function main() {
  const books = await prisma.book.findMany({ where: { deletedByAuthorAt: null }, include: { author: { include: { user: true } } } });
  let ai = 0, none = 0, empty = 0;
  const legacy: { id: string; title: string; author: string; text: string }[] = [];
  for (const b of books) {
    const v = ((b.submissionMetadata as Record<string, unknown> | null)?.aiDeclaration as string | undefined) ?? "";
    if (aiChoiceOf(v) === "ai") ai++;
    else if (aiChoiceOf(v) === "none") none++;
    else if (isLegacyAiText(v)) legacy.push({ id: b.id, title: b.title, author: b.author?.user?.email ?? "?", text: v.trim() });
    else empty++;
  }
  console.log(`Book records: ${books.length}`);
  console.log(`Already "AI used": ${ai}; already "No AI": ${none}; no declaration: ${empty}; older written declaration: ${legacy.length}`);
  for (const l of legacy) console.log(`- ${l.author} | ${l.title} (${l.id}) | "${l.text.slice(0, 120)}"`);
  console.log("\nNothing was changed.");
}
main().finally(() => prisma.$disconnect());
