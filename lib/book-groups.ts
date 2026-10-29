/**
 * One book, one entry. A title is stored as one record per edition (or, on older
 * records, one record holding several formats). Wherever books are listed - the
 * storefront, the author's My Books, the admin books table - the editions of the same
 * title by the same author are shown as ONE book with a tab per format.
 *
 * This only changes how books are DISPLAYED. No record is merged, edited or deleted.
 *
 * Two records are the same book when they have the same author and the same title
 * (ignoring case and extra spaces) AND their formats do not overlap - two eBook
 * records with the same title are two separate books (for example a re-submission),
 * never merged.
 */

export interface EditionRow {
  id: string;
  authorId: string;
  title: string;
  createdAt: Date;
  hasEbook: boolean;
  hasPrint: boolean;
  hasAudiobook: boolean;
}

export function titleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatsOf(r: EditionRow): ("ebook" | "audiobook" | "print")[] {
  return [r.hasEbook && "ebook", r.hasAudiobook && "audiobook", r.hasPrint && "print"].filter(Boolean) as ("ebook" | "audiobook" | "print")[];
}

/** Groups editions of the same title. Within a group the first row is the "main" one:
 * the one that holds the eBook, else the audiobook, else the oldest. Groups keep the
 * order of their newest member as it appears in `rows` (so a newest-first list stays
 * newest-first). */
export function groupEditions<T extends EditionRow>(rows: readonly T[]): T[][] {
  const oldestFirst = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const groups: { key: string; members: T[]; formats: Set<string> }[] = [];
  for (const row of oldestFirst) {
    const key = `${row.authorId}::${titleKey(row.title)}`;
    const fmts = formatsOf(row);
    const home = groups.find((g) => g.key === key && fmts.every((f) => !g.formats.has(f)));
    if (home) {
      home.members.push(row);
      fmts.forEach((f) => home.formats.add(f));
    } else {
      groups.push({ key, members: [row], formats: new Set(fmts) });
    }
  }
  const rank = (r: T) => (r.hasEbook ? 0 : r.hasAudiobook ? 1 : 2);
  const ordered = groups.map((g) => [...g.members].sort((a, b) => rank(a) - rank(b) || a.createdAt.getTime() - b.createdAt.getTime()));
  const position = new Map(rows.map((r, i) => [r.id, i]));
  ordered.sort((a, b) => Math.min(...a.map((r) => position.get(r.id) ?? 0)) - Math.min(...b.map((r) => position.get(r.id) ?? 0)));
  return ordered;
}

/** Groups that actually combine more than one record - what a "merge" would touch. */
export function splitTitles<T extends EditionRow>(rows: readonly T[]): T[][] {
  return groupEditions(rows).filter((g) => g.length > 1);
}
