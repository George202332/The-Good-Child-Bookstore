import { prisma } from "@/lib/prisma";
import { printDetailsProblems, worstLevel, type PrintDetailsProblem } from "@/lib/print-details-check";
import { readBookFlags, type BookFlag } from "@/lib/site-health/quote-log";

export interface PrintBookIssue {
  bookId: string;
  title: string;
  level: "error" | "warning";
  problems: string[];
  /** A real customer was stopped by this book (set when a price request failed because of it). */
  flagged?: BookFlag;
}

/**
 * Printed books whose print details are incomplete, or that stopped a real customer from getting a shipping price. Read only.
 * Used by the admin Books table and the Lulu Publishing tab. Only books that are sold in print (a paperback or hardcover price).
 */
export async function listPrintBookIssues(): Promise<Record<string, PrintBookIssue>> {
  const [books, flags] = await Promise.all([
    prisma.book.findMany({
      where: { OR: [{ paperbackPrice: { not: null } }, { hardcoverPrice: { not: null } }] },
      select: { id: true, title: true, submissionMetadata: true, files: { select: { kind: true } } },
    }),
    readBookFlags(),
  ]);
  const out: Record<string, PrintBookIssue> = {};
  for (const b of books) {
    const problems: PrintDetailsProblem[] = printDetailsProblems({ submissionMetadata: b.submissionMetadata, hasInteriorFile: b.files.some((f) => f.kind === "MANUSCRIPT"), hasPrintFormat: true });
    const flagged = flags[b.id];
    const level = worstLevel(problems) ?? (flagged ? "error" : null);
    if (!level) continue;
    out[b.id] = { bookId: b.id, title: b.title, level, problems: problems.map((p) => p.message), flagged };
  }
  return out;
}
