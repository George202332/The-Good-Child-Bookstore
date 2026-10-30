import { capitalizeName } from "@/lib/person-name";

/** Resolves the correct author display name for a book, in priority
 * order: the name actually typed into the "Author" field at
 * submission (stored per-book in submissionMetadata — this is what
 * lets an author use a different pen name for different books), then
 * the author's profile-level pen name (a single, standing pen name
 * set on their account), then finally their real account name as a
 * last resort for older submissions that predate this field. */
export function bookAuthorDisplayName(book: {
  submissionMetadata?: unknown;
  author: { penName?: string | null; user: { name: string } };
}): string {
  const meta = (book.submissionMetadata as { authorFirstName?: string; authorLastName?: string } | null) ?? null;
  const submittedName = meta?.authorFirstName || meta?.authorLastName
    ? `${meta.authorFirstName ?? ""} ${meta.authorLastName ?? ""}`.trim()
    : null;
  return capitalizeName(submittedName || book.author.penName || book.author.user.name);
}

/** Two author names count as the same person when they match ignoring case,
 * extra spaces and accents ("Jamie  Rivers" = "jamie rivers"). */
export function normaliseAuthorName(name: string): string {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function sameAuthorName(a: string, b: string): boolean {
  return normaliseAuthorName(a) === normaliseAuthorName(b);
}
