/**
 * What an account has bought, for My Library and the order pages. Two rules:
 *
 *   1. Every query names only the columns it needs, so a database that is a step behind the code (a newly added column
 *      not yet applied) can never crash these pages.
 *   2. One broken record never crashes the page: it is skipped, counted and logged, and the rest is shown.
 *
 * Books an account has BOUGHT are listed here only. The books an author WROTE live under My Books and are never mixed in.
 */

export interface LibraryLineInput {
  bookId: string;
  format: string | null;
  book: {
    title?: string | null;
    isbn?: string | null;
    submissionMetadata?: unknown;
    author?: { penName?: string | null; user?: { name?: string | null } | null } | null;
    files?: { kind: string }[] | null;
  } | null;
}

export interface LibraryItem {
  id: string;
  sn: string;
  title: string;
  author: string;
  format: string;
  rawFormat: string | null;
  hasAudio: boolean;
  copies: number;
}

/** Groups purchased lines into one row per book and format. A line that cannot be read is skipped and counted. */
export function buildLibraryRows(
  lines: LibraryLineInput[],
  authorName: (book: NonNullable<LibraryLineInput["book"]>) => string,
): { rows: LibraryItem[]; skipped: number } {
  const items = new Map<string, LibraryItem>();
  let skipped = 0;
  for (const line of lines) {
    try {
      if (!line || !line.bookId || !line.book || !line.book.title) { skipped += 1; continue; }
      const key = `${line.bookId}:${line.format ?? ""}`;
      const existing = items.get(key);
      if (existing) { existing.copies += 1; continue; }
      items.set(key, {
        id: line.bookId,
        sn: line.book.isbn || "—",
        title: line.book.title,
        author: authorName(line.book),
        format: line.format ? line.format.charAt(0).toUpperCase() + line.format.slice(1) : "—",
        rawFormat: line.format,
        hasAudio: (line.book.files ?? []).some((f) => f.kind === "AUDIOBOOK"),
        copies: 1,
      });
    } catch {
      skipped += 1;
    }
  }
  return { rows: Array.from(items.values()), skipped };
}
