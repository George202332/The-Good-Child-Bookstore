/**
 * Deleting ONE edition of a book: the "eBook and Audiobook" edition, or the "Print"
 * edition. Pure decisions live here (and are tested); the database work is in
 * actions/submissions.ts deleteEdition().
 */

export type Edition = "digital" | "print";

export interface EditionRecord {
  hasEbook: boolean;
  hasAudiobook: boolean;
  hasPrint: boolean;
}

export type EditionDeletePlan =
  | { kind: "remove-record" } // the record holds only this edition: remove the whole record
  | { kind: "clear-part" } // an older combined record: clear only this edition's part, keep the rest
  | { kind: "wrong-tab" }; // the record has nothing of this edition

const hasDigital = (r: EditionRecord) => r.hasEbook || r.hasAudiobook;

export function planEditionDelete(record: EditionRecord, edition: Edition): EditionDeletePlan {
  const hasThis = edition === "print" ? record.hasPrint : hasDigital(record);
  if (!hasThis) return { kind: "wrong-tab" };
  const hasOther = edition === "print" ? hasDigital(record) : record.hasPrint;
  return hasOther ? { kind: "clear-part" } : { kind: "remove-record" };
}

/** The ids of uploaded files mentioned in file addresses (/api/files/<id>) and in a JSON blob. */
export function uploadedFileIdsIn(texts: (string | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.matchAll(/\/api\/files\/([A-Za-z0-9_-]+)/g)) ids.add(m[1]);
    for (const m of t.matchAll(/"[A-Za-z]*FileId"\s*:\s*"([A-Za-z0-9_-]+)"/g)) ids.add(m[1]);
  }
  return [...ids];
}
