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

/** Which file a problem belongs to: the interior pages, the cover, or both/unknown. */
export type IssueFile = "interior" | "cover" | "both";

export interface ShownIssue {
  source: "site" | "lulu";
  file: IssueFile;
  message: string;
  fix: string;
}

const INTERIOR_CODES = new Set<PreflightIssue["code"]>(["ENCRYPTED", "UNREADABLE", "FONTS", "PAGE_SIZE", "PAGE_COUNT", "NOT_PDF"]);
const COVER_CODES = new Set<PreflightIssue["code"]>(["COVER_SIZE", "COVER_MISSING", "COVER_UNREADABLE"]);

export function fileOfSiteIssue(code: PreflightIssue["code"]): IssueFile {
  return INTERIOR_CODES.has(code) ? "interior" : COVER_CODES.has(code) ? "cover" : "both";
}

/** The verdict shown under each file. WAITING = this file has not been sent to Lulu yet
 * because the other file must be fixed first. */
export type FileVerdict = PreflightStatus | "WAITING" | "NONE";

export interface PreflightSummary {
  status: PreflightStatus;
  issues: ShownIssue[];
  /** The verdict for each file, shown under that file's preview. */
  interior: FileVerdict;
  cover: FileVerdict;
}

/** How long a check may stay "checking" before it is reported as unavailable. */
export const PREFLIGHT_TIMEOUT_MS = 5 * 60 * 1000;

const FORMAT_NAME = { paperback: "paperback", hardcover: "hardcover" } as const;

function summarizeCore(opts: { siteIssues: PreflightIssue[]; jobs: PreflightJob[]; startedAt: Date; now?: Date; unavailableReason?: string }): Pick<PreflightSummary, "status" | "issues"> {
  const issues: ShownIssue[] = opts.siteIssues.map((i) => ({ source: "site" as const, file: fileOfSiteIssue(i.code), message: i.message, fix: i.fix }));
  if (opts.siteIssues.length > 0) return { status: "FAILED", issues };

  if (opts.unavailableReason) {
    return { status: "UNAVAILABLE", issues: [{ source: "lulu", file: "both", message: opts.unavailableReason, fix: "Press \"Check again\" in a minute. You can still save a draft; the book can be sent for review once this check passes." }] };
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
      issues.push({ source: "lulu", file: job.kind, message, fix: e.fix });
    }
  }
  if (issues.length > 0) return { status: "FAILED", issues };

  const errored = opts.jobs.find((j) => j.state === "error");
  if (errored) {
    return {
      status: "UNAVAILABLE",
      issues: [{ source: "lulu", file: errored.kind, message: `Lulu's check could not be completed (${errored.errors[0] ?? "no reply"}).`, fix: "Press \"Check again\" in a minute. You can still save a draft; the book can be sent for review once this check passes." }],
    };
  }

  if (opts.jobs.length > 0 && opts.jobs.every((j) => j.state === "passed")) return { status: "PASSED", issues: [] };

  const now = opts.now ?? new Date();
  if (now.getTime() - opts.startedAt.getTime() > PREFLIGHT_TIMEOUT_MS) {
    return { status: "UNAVAILABLE", issues: [{ source: "lulu", file: "both", message: "Lulu is taking too long to answer.", fix: "Press \"Check again\" in a minute." }] };
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


/** What happened to each file, so the interior and the cover each get their own verdict. */
function verdictFor(kind: "interior" | "cover", core: Pick<PreflightSummary, "status" | "issues">, opts: { siteIssues: PreflightIssue[]; jobs: PreflightJob[] }): FileVerdict {
  if (core.issues.some((i) => i.file === kind || (i.file === "both" && core.status === "FAILED"))) return "FAILED";
  if (opts.siteIssues.length > 0) return "WAITING"; // Lulu is only asked once the site checks pass
  const mine = opts.jobs.filter((j) => j.kind === kind);
  if (core.status === "UNAVAILABLE") return "UNAVAILABLE";
  if (mine.length > 0 && mine.every((j) => j.state === "passed")) return "PASSED";
  if (mine.some((j) => j.state === "failed")) return "FAILED";
  if (mine.some((j) => j.state === "error")) return "UNAVAILABLE";
  return "CHECKING";
}

export function summarizePreflight(opts: { siteIssues: PreflightIssue[]; jobs: PreflightJob[]; startedAt: Date; now?: Date; unavailableReason?: string }): PreflightSummary {
  const core = summarizeCore(opts);
  return { ...core, interior: verdictFor("interior", core, opts), cover: verdictFor("cover", core, opts) };
}
