/**
 * Combines the site's own findings with Lulu's validation jobs into the one result
 * the author sees (and that is saved on the book). Pure, so the rules are tested
 * without a network.
 *
 *   PASSED       the site checks found nothing AND every Lulu job passed
 *   FAILED       the site found a problem, or Lulu reported one (Lulu has the final word)
 *   CHECKING     Lulu is still working
 *   UNAVAILABLE  the check could not be completed (Lulu unreachable, not set up, or too slow)
 */

import { explainLuluError } from "@/lib/lulu-validation";
import type { PreflightIssue } from "@/lib/print-preflight";

export type PreflightStatus = "CHECKING" | "PASSED" | "FAILED" | "UNAVAILABLE";

export interface PreflightJob {
  kind: "interior" | "cover";
  format: "paperback" | "hardcover";
  packageId: string;
  /** Lulu's id for the job; absent when the job could not be started. */
  id?: string;
  state: "running" | "passed" | "failed" | "error";
  status?: string;
  errors: string[];
}

export interface ShownIssue {
  source: "site" | "lulu";
  message: string;
  fix: string;
}

export interface PreflightSummary {
  status: PreflightStatus;
  issues: ShownIssue[];
}

/** How long a check may stay "checking" before it is reported as unavailable. */
export const PREFLIGHT_TIMEOUT_MS = 5 * 60 * 1000;

const FORMAT_NAME = { paperback: "paperback", hardcover: "hardcover" } as const;

export function summarizePreflight(opts: { siteIssues: PreflightIssue[]; jobs: PreflightJob[]; startedAt: Date; now?: Date; unavailableReason?: string }): PreflightSummary {
  const issues: ShownIssue[] = opts.siteIssues.map((i) => ({ source: "site", message: i.message, fix: i.fix }));
  if (opts.siteIssues.length > 0) return { status: "FAILED", issues };

  if (opts.unavailableReason) {
    return { status: "UNAVAILABLE", issues: [{ source: "lulu", message: opts.unavailableReason, fix: "Press \"Check again\" in a minute. You can still save a draft; the book can be sent for review once this check passes." }] };
  }

  const seen = new Set<string>();
  for (const job of opts.jobs) {
    if (job.state !== "failed") continue;
    for (const raw of job.errors.length > 0 ? job.errors : ["The file did not pass."]) {
      const e = explainLuluError(raw);
      const both = opts.jobs.some((j) => j !== job && j.kind === job.kind && j.format !== job.format);
      const message = `${job.kind === "cover" ? "Cover" : "Interior"}${both ? ` (${FORMAT_NAME[job.format]})` : ""}: ${e.message}`;
      if (seen.has(message)) continue;
      seen.add(message);
      issues.push({ source: "lulu", message, fix: e.fix });
    }
  }
  if (issues.length > 0) return { status: "FAILED", issues };

  const errored = opts.jobs.find((j) => j.state === "error");
  if (errored) {
    return {
      status: "UNAVAILABLE",
      issues: [{ source: "lulu", message: `Lulu's check could not be completed (${errored.errors[0] ?? "no reply"}).`, fix: "Press \"Check again\" in a minute. You can still save a draft; the book can be sent for review once this check passes." }],
    };
  }

  if (opts.jobs.length > 0 && opts.jobs.every((j) => j.state === "passed")) return { status: "PASSED", issues: [] };

  const now = opts.now ?? new Date();
  if (now.getTime() - opts.startedAt.getTime() > PREFLIGHT_TIMEOUT_MS) {
    return { status: "UNAVAILABLE", issues: [{ source: "lulu", message: "Lulu is taking too long to answer.", fix: "Press \"Check again\" in a minute." }] };
  }
  return { status: "CHECKING", issues: [] };
}

/** What is saved on the book so the author and admin can see the status later. */
export interface SavedPreflight {
  status: PreflightStatus;
  checkedAt: string;
  checkId: string;
  interiorFileId: string;
  coverKey: string;
  packageIds: string;
  reasons: string[];
}

export function coverKeyFor(opts: { customCoverFileId?: string | null; frontCoverImageUrl?: string | null }): string {
  return opts.customCoverFileId ? `custom:${opts.customCoverFileId}` : `front:${opts.frontCoverImageUrl ?? ""}`;
}

export function packageKey(ids: string[]): string {
  return [...ids].sort().join(",");
}
