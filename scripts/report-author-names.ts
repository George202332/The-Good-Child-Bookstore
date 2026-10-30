/**
 * Round 51 - READ-ONLY REPORT. It changes NOTHING in the database.
 *
 * Author names are now saved and shown with the first letter of every name part capitalised
 * ("anne-marie o'brien" becomes "Anne-Marie O'Brien"). Names are already shown that way everywhere, so
 * nothing on the site looks wrong; this lists the STORED names that are not yet written that way, so you
 * can decide whether to tidy the stored text too (nothing is changed until you approve).
 *
 * Usage (PowerShell, from the bookstore folder):
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/report-author-names.ts
 */
import { PrismaClient } from "@prisma/client";
import { capitalizeName, nameWouldChange } from "../lib/person-name";

const prisma = new PrismaClient();

async function main() {
  const aliases = await prisma.authorAlias.findMany();
  const aliasChanges = aliases.filter((a) => nameWouldChange(a.firstName) || nameWouldChange(a.lastName));
  console.log(`Saved author names (pen names list): ${aliases.length}; would change: ${aliasChanges.length}`);
  for (const a of aliasChanges) console.log(`- ${a.id}: "${a.firstName} ${a.lastName}" -> "${capitalizeName(a.firstName)} ${capitalizeName(a.lastName)}"`);

  const books = await prisma.book.findMany({ select: { id: true, title: true, submissionMetadata: true } });
  let bookChanges = 0;
  for (const b of books) {
    const m = (b.submissionMetadata as { authorFirstName?: string; authorLastName?: string } | null) ?? {};
    if (nameWouldChange(m.authorFirstName) || nameWouldChange(m.authorLastName)) {
      bookChanges++;
      console.log(`- book ${b.id} "${b.title}": "${m.authorFirstName ?? ""} ${m.authorLastName ?? ""}" -> "${capitalizeName(m.authorFirstName)} ${capitalizeName(m.authorLastName)}"`);
    }
  }
  console.log(`Books whose stored author name would change: ${bookChanges} of ${books.length}`);
  console.log("\nNothing was changed.");
}
main().finally(() => prisma.$disconnect());
