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
  return submittedName || book.author.penName || book.author.user.name;
}
