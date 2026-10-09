/**
 * Pure helpers for the writer's "My Blogs" table: status label, status
 * pill class (same colour language as My Books) and which row actions
 * apply. Kept free of Prisma / React so they can be unit-tested.
 */

export type BlogStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED" | "SUSPENDED" | "WITHDRAWN";

const LABELS: Record<BlogStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
  SUSPENDED: "Suspended",
  WITHDRAWN: "Withdrawn",
};

const PILL_CLASSES: Record<BlogStatus, string> = {
  DRAFT: "status-draft",
  PENDING_REVIEW: "status-review",
  PUBLISHED: "status-published",
  REJECTED: "status-attention",
  ARCHIVED: "status-suspended",
  SUSPENDED: "status-attention",
  WITHDRAWN: "status-suspended",
};

export function blogStatusLabel(status: string): string {
  return LABELS[status as BlogStatus] ?? status;
}

export function blogStatusPillClass(status: string): string {
  return PILL_CLASSES[status as BlogStatus] ?? "status-draft";
}

/** Matches updateBlogPost (actions/blog.ts): only Draft / Rejected posts are editable. */
export function canEdit(status: string): boolean {
  return status === "DRAFT" || status === "REJECTED";
}

/** Withdraw takes a post off the public site / review queue and returns it to Draft. */
export function canWithdraw(status: string): boolean {
  return status === "PUBLISHED" || status === "PENDING_REVIEW";
}

/** A writer may delete their own post at any status. */
export function canDelete(status: string): boolean {
  return Boolean(status);
}

export const WITHDRAW_CONFIRM = "Withdraw this blog? It will no longer be visible to readers.";
export const DELETE_CONFIRM = "Delete this blog permanently? This cannot be undone.";
export const DELETE_PUBLISHED_CONFIRM =
  "This blog is live and visible to readers. Delete it permanently? Its comments will be deleted too. This cannot be undone.";

export function deleteConfirmMessage(status: string): string {
  return status === "PUBLISHED" ? DELETE_PUBLISHED_CONFIRM : DELETE_CONFIRM;
}

export interface BlogCounts {
  total: number;
  published: number;
  pending: number;
  drafts: number;
}

export function countBlogs(statuses: string[]): BlogCounts {
  return {
    total: statuses.length,
    published: statuses.filter((s) => s === "PUBLISHED").length,
    pending: statuses.filter((s) => s === "PENDING_REVIEW").length,
    drafts: statuses.filter((s) => s === "DRAFT").length,
  };
}

export function blogSummaryLine(c: BlogCounts): string {
  return `${c.total} ${c.total === 1 ? "post" : "posts"}: ${c.published} published, ${c.pending} pending review, ${c.drafts} ${c.drafts === 1 ? "draft" : "drafts"}`;
}

/** Which date to show: the live date only for a Published post (a future
 * publishAt reads as scheduled); otherwise a dash with the submitted date. */
export function blogDateInfo(
  status: string,
  publishAt: Date | null,
  createdAt: Date,
  now: Date = new Date()
): { primary: "published" | "scheduled" | "none"; date: Date | null; submitted: Date } {
  if (status === "PUBLISHED" && publishAt) {
    return { primary: publishAt > now ? "scheduled" : "published", date: publishAt, submitted: createdAt };
  }
  return { primary: "none", date: null, submitted: createdAt };
}
