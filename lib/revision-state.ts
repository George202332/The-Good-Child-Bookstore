/**
 * The edit of a published book that is waiting, being worked on, or sent back. It lives in Book.pendingRevisionData (no extra
 * database column): the live, approved book is never touched until a reviewer approves the new version.
 *
 *   DRAFT    the author saved an edit but has not pressed Republish; reviewers do not see it yet
 *   PENDING  the author pressed Republish; it waits for a reviewer ("Awaiting Review")
 *   REJECTED the reviewer sent it back with a note ("Needs Attention"); the author keeps the edit as a draft
 *
 * Older records (a held manuscript/cover, or a held full edit saved before states existed) have no state and count as PENDING.
 */

export type RevisionState = "NONE" | "DRAFT" | "PENDING" | "REJECTED";

export function revisionStateOf(data: unknown): RevisionState {
  if (data == null || typeof data !== "object") return "NONE";
  const s = (data as { state?: unknown }).state;
  if (s === "DRAFT" || s === "REJECTED") return s;
  return "PENDING";
}

/** True when a reviewer has something to do for this record's held edit. */
export function isAwaitingReview(data: unknown): boolean {
  return revisionStateOf(data) === "PENDING";
}

/** What the author sees beside the edit of a live book. */
export type AuthorRevisionStatus = "Awaiting Review" | "Needs Attention" | "Draft Saved" | "Approved";

export function authorRevisionStatus(data: unknown, lastOutcome?: { state?: string } | null): AuthorRevisionStatus | null {
  const s = revisionStateOf(data);
  if (s === "PENDING") return "Awaiting Review";
  if (s === "REJECTED") return "Needs Attention";
  if (s === "DRAFT") return "Draft Saved";
  if (lastOutcome?.state === "APPROVED") return "Approved";
  return null;
}

export interface HeldFullRevision {
  kind: "full";
  state: "DRAFT" | "PENDING" | "REJECTED";
  submittedAt?: string;
  /** The reviewer's note when sent back. */
  note?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  /** The author's whole edit, exactly as the form sent it. */
  input: unknown;
  bookFiles: { kind: string; url: string }[];
  /** What the book row would hold once approved: the edit form is filled from this so the author keeps working on their edit. */
  projected?: ProjectedBook;
}

export interface ProjectedBook {
  fields: Record<string, unknown>;
  files: { kind: string; url: string }[];
  genreName: string;
  subcategoryName: string;
}
