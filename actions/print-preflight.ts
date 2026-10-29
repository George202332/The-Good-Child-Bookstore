"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { absoluteFileUrl } from "@/lib/lulu-order";
import { packagesFor } from "@/lib/print-preflight-packages";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { checkCoverSize, inspectPdf, runInteriorChecks, type PreflightIssue } from "@/lib/print-preflight";
import {
  coverKeyFor,
  packageKey,
  summarizePreflight,
  type PreflightJob,
  type PreflightStatus,
  type ShownIssue,
} from "@/lib/print-preflight-result";
import { getLuluValidation, luluExpectedCoverSize, luluIsConfigured, startLuluValidation, storeGeneratedCoverWrap } from "@/lib/payments/lulu";
import { reportSystemError } from "@/lib/site-health/alert";

/**
 * Print pre-flight for "Submit a New Title" -> Print tab. Two layers: the site's own
 * quick checks (lib/print-preflight.ts) and Lulu's file validation, with Lulu's result
 * as the final word. Validation only: nothing here creates a Lulu print job or order.
 *
 * Because Lulu's validation is asynchronous (it downloads the file and works on it),
 * this is split in two short calls so no request waits on Lulu: startPrintPreflight
 * does the site checks and starts the Lulu jobs, and pollPrintPreflight (called every
 * few seconds by the form) reads their progress. Each call finishes in seconds, well
 * inside the serverless time limit.
 */

export interface PrintPreflightInput {
  interiorFileId: string;
  frontCoverImageUrl?: string;
  customCoverFileId?: string;
  trimCode: string;
  paperbackEnabled: boolean;
  hardcoverEnabled: boolean;
  paperbackBinding: string;
  interiorColor: string;
  printQuality: string;
  paperType: string;
  coverFinish: string;
  linenColor: string;
  foilColor: string;
  title: string;
  authorName: string;
}

export interface PrintPreflightView {
  ok: boolean;
  checkId?: string;
  status?: PreflightStatus;
  issues?: ShownIssue[];
  /** Set when the request itself could not be handled (not signed in, bad input). */
  error?: string;
}

function asJobs(value: unknown): PreflightJob[] {
  return Array.isArray(value) ? (value as PreflightJob[]) : [];
}
function asIssues(value: unknown): PreflightIssue[] {
  return Array.isArray(value) ? (value as PreflightIssue[]) : [];
}

function view(row: { id: string; status: string; siteIssues: unknown; luluJobs: unknown; createdAt: Date; reasons: unknown }, summary?: { status: PreflightStatus; issues: ShownIssue[] }): PrintPreflightView {
  const s = summary ?? summarizePreflight({ siteIssues: asIssues(row.siteIssues), jobs: asJobs(row.luluJobs), startedAt: row.createdAt });
  return { ok: true, checkId: row.id, status: s.status, issues: s.issues };
}

async function requireAuthor() {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return null;
  return session.user;
}

export async function startPrintPreflight(input: PrintPreflightInput): Promise<PrintPreflightView> {
  const user = await requireAuthor();
  if (!user) return { ok: false, error: "Only author accounts can check print files." };
  if (!input.interiorFileId) return { ok: false, error: "Upload the print-ready interior PDF first." };
  const packages = packagesFor(input);
  if (packages.length === 0) return { ok: false, error: "Turn on Paperback or Hardcover first." };

  const interior = await prisma.uploadedFile.findUnique({ where: { id: input.interiorFileId } });
  const siteIssues: PreflightIssue[] = [];
  let pageCount: number | null = null;
  const coverKey = coverKeyFor({ customCoverFileId: input.customCoverFileId, frontCoverImageUrl: input.frontCoverImageUrl });

  if (!interior) {
    siteIssues.push({ code: "UNREADABLE", message: "The interior file could not be found.", fix: "Upload the print-ready PDF again." });
  } else if (interior.mimeType !== "application/pdf") {
    siteIssues.push({ code: "NOT_PDF", message: "The interior is not a PDF. Print files must be PDF.", fix: "Export the interior as a PDF and upload that." });
  } else {
    const r = await runInteriorChecks(new Uint8Array(interior.data), { trimCode: input.trimCode, bindingCodes: packages.map((p) => p.bindingCode) });
    siteIssues.push(...r.issues);
    pageCount = r.pageCount;
  }

  // Cover: a custom wraparound must be a PDF at the cover specification's size;
  // otherwise the front image is needed (the wrap is built from it).
  let customCoverBytes: Uint8Array | null = null;
  if (input.customCoverFileId) {
    const f = await prisma.uploadedFile.findUnique({ where: { id: input.customCoverFileId } });
    if (!f || f.mimeType !== "application/pdf") {
      siteIssues.push({ code: "COVER_UNREADABLE", message: "The custom cover is missing or is not a PDF.", fix: "Upload your full wraparound cover as a PDF, or remove it to use your front cover image." });
    } else customCoverBytes = new Uint8Array(f.data);
  } else if (!input.frontCoverImageUrl) {
    siteIssues.push({ code: "COVER_MISSING", message: "There is no cover yet.", fix: "Upload your front cover image (or a full wraparound cover PDF)." });
  }

  const configured = await luluIsConfigured();
  const siteUrl = getPublicSiteUrl();
  const reachable = !/^https?:\/\/(localhost|127\.|0\.0\.0\.0)/i.test(siteUrl);

  // Cover size against the cover specification (needs the page count and Lulu's sizes).
  if (customCoverBytes && pageCount && configured && siteIssues.length === 0) {
    try {
      const info = await inspectPdf(customCoverBytes);
      const first = info.pages[0];
      if (first) {
        for (const p of packages) {
          const expected = await luluExpectedCoverSize(p.packageId, pageCount);
          if (!expected) continue;
          const issue = checkCoverSize({ widthPt: first.widthIn * 72, heightPt: first.heightIn * 72 }, expected);
          if (issue) { siteIssues.push({ ...issue, message: packages.length > 1 ? `${p.format === "hardcover" ? "Hardcover" : "Paperback"}: ${issue.message}` : issue.message }); }
        }
      }
    } catch {
      siteIssues.push({ code: "COVER_UNREADABLE", message: "The custom cover PDF could not be read.", fix: "Export the cover again as a PDF and upload it." });
    }
  }

  const base = {
    userId: user.id,
    interiorFileId: input.interiorFileId,
    coverKey,
    packageIds: packageKey(packages.map((p) => p.packageId)),
    pageCount,
    luluEnvironment: null as string | null,
  };

  if (siteIssues.length > 0) {
    const row = await prisma.printPreflightCheck.create({
      data: { ...base, status: "FAILED", siteIssues: JSON.parse(JSON.stringify(siteIssues)), luluJobs: [], completedAt: new Date() },
    });
    return view(row, summarizePreflight({ siteIssues, jobs: [], startedAt: row.createdAt }));
  }

  const unavailable = async (reason: string) => {
    const row = await prisma.printPreflightCheck.create({ data: { ...base, status: "UNAVAILABLE", siteIssues: [], luluJobs: [], completedAt: new Date() } });
    return view(row, summarizePreflight({ siteIssues: [], jobs: [], startedAt: row.createdAt, unavailableReason: reason }));
  };
  if (!configured) return unavailable("Lulu's file check is not set up yet (the store's Lulu keys are missing).");
  if (!reachable) return unavailable("Lulu cannot download files from this site address, so its check cannot run here.");

  // Start Lulu's validation for the interior and the cover, for each print format.
  const jobs: PreflightJob[] = [];
  let coverWrapFileId: string | null = null;
  const interiorUrl = absoluteFileUrl(`/api/files/${input.interiorFileId}`, siteUrl)!;
  for (const p of packages) {
    const i = await startLuluValidation({ kind: "interior", sourceUrl: interiorUrl, podPackageId: p.packageId });
    jobs.push(i.ok
      ? { kind: "interior", format: p.format, packageId: p.packageId, id: i.id, state: i.parsed.state, status: i.parsed.status, errors: i.parsed.errors }
      : { kind: "interior", format: p.format, packageId: p.packageId, state: "error", errors: [i.error] });

    let coverFileId = input.customCoverFileId ?? null;
    if (!coverFileId) {
      const wrap = await storeGeneratedCoverWrap({
        frontCoverImageUrl: input.frontCoverImageUrl!, title: input.title || "Untitled", authorName: input.authorName,
        podPackageId: p.packageId, pageCount: pageCount ?? 0, trimCode: input.trimCode,
      });
      if (!wrap.ok) {
        jobs.push({ kind: "cover", format: p.format, packageId: p.packageId, state: "error", errors: [wrap.error] });
        continue;
      }
      coverFileId = wrap.fileId;
      coverWrapFileId = wrap.fileId;
    }
    const c = await startLuluValidation({
      kind: "cover", sourceUrl: absoluteFileUrl(`/api/files/${coverFileId}`, siteUrl)!, podPackageId: p.packageId, interiorPageCount: pageCount ?? undefined,
    });
    jobs.push(c.ok
      ? { kind: "cover", format: p.format, packageId: p.packageId, id: c.id, state: c.parsed.state, status: c.parsed.status, errors: c.parsed.errors }
      : { kind: "cover", format: p.format, packageId: p.packageId, state: "error", errors: [c.error] });
  }

  const summary = summarizePreflight({ siteIssues: [], jobs, startedAt: new Date() });
  const row = await prisma.printPreflightCheck.create({
    data: {
      ...base, status: summary.status, siteIssues: [], luluJobs: JSON.parse(JSON.stringify(jobs)),
      coverWrapFileId, completedAt: summary.status === "CHECKING" ? null : new Date(),
    },
  });
  if (jobs.some((j) => j.state === "error")) {
    await reportSystemError("OTHER", new Error(`Lulu validation could not start: ${jobs.filter((j) => j.state === "error").map((j) => j.errors[0]).join("; ")}`), { userId: user.id }).catch(() => {});
  }
  return view(row, summary);
}

export async function pollPrintPreflight(checkId: string): Promise<PrintPreflightView> {
  const user = await requireAuthor();
  if (!user) return { ok: false, error: "Only author accounts can check print files." };
  const row = await prisma.printPreflightCheck.findUnique({ where: { id: checkId } });
  if (!row || row.userId !== user.id) return { ok: false, error: "That check was not found." };
  if (row.status !== "CHECKING") return view(row);

  const jobs = asJobs(row.luluJobs);
  for (const job of jobs) {
    if (job.state !== "running" || !job.id) continue;
    const r = await getLuluValidation(job.kind, job.id);
    if (!r.ok) { job.errors = [r.error]; continue; } // keep "running"; the timeout reports it if Lulu stays silent
    job.state = r.parsed.state;
    job.status = r.parsed.status;
    job.errors = r.parsed.errors;
  }
  const summary = summarizePreflight({ siteIssues: [], jobs, startedAt: row.createdAt });
  const updated = await prisma.printPreflightCheck.update({
    where: { id: row.id },
    data: { status: summary.status, luluJobs: JSON.parse(JSON.stringify(jobs)), completedAt: summary.status === "CHECKING" ? null : new Date() },
  });
  return view(updated, summary);
}
