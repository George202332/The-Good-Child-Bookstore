/**
 * Decides whether an edit to an already-published book must go back
 * through admin review. Only a replaced manuscript (print interior PDF
 * for print titles) or a replaced cover triggers review; every other
 * edit applies immediately. Pure: no I/O, so it is unit-testable and the
 * server action can call it with values it read from the database
 * itself (never with a client-supplied flag).
 */

/** Reduces a file reference to a comparable key. "/api/files/abc?x=1",
 * "abc" and " abc " all become "abc"; any other URL is compared as the
 * trimmed string. Empty/nullish becomes null. */
export function fileRefKey(ref: string | null | undefined): string | null {
  const trimmed = (ref ?? "").trim();
  if (!trimmed) return null;
  const match = /\/api\/files\/([^/?#]+)/.exec(trimmed);
  if (match) return match[1];
  return trimmed;
}

export interface ReReviewInput {
  currentManuscriptRef?: string | null;
  newManuscriptRef?: string | null;
  currentCoverRef?: string | null;
  newCoverRef?: string | null;
}

export interface ReReviewDecision {
  manuscript: boolean;
  cover: boolean;
  required: boolean;
}

/** True only when a file is supplied that differs from the current one.
 * Sending nothing is not a replacement (the caller keeps the current
 * file), and re-sending the same file is not a re-upload. */
function isReplaced(current: string | null | undefined, next: string | null | undefined): boolean {
  const nextKey = fileRefKey(next);
  if (nextKey === null) return false;
  return nextKey !== fileRefKey(current);
}

export function needsReReview(input: ReReviewInput): ReReviewDecision {
  const manuscript = isReplaced(input.currentManuscriptRef, input.newManuscriptRef);
  const cover = isReplaced(input.currentCoverRef, input.newCoverRef);
  return { manuscript, cover, required: manuscript || cover };
}
