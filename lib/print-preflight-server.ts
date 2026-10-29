import { prisma } from "@/lib/prisma";
import { decidePreflightGate } from "@/lib/print-preflight-gate";
import { packagesFor } from "@/lib/print-preflight-packages";
import { coverKeyFor, packageKey, type SavedPreflight } from "@/lib/print-preflight-result";

interface PrintMeta {
  trimSizeCode?: string; paperbackEnabled?: boolean; hardcoverEnabled?: boolean; binding?: string;
  interiorColor?: string; printQuality?: string; paperType?: string; coverFinish?: string; linenColor?: string; foilColor?: string;
  frontCoverImageUrl?: string; customBackCoverPdfFileId?: string; backCoverMode?: string;
  printPreflight?: SavedPreflight;
}

/**
 * Called when a print edition is saved. Checks the interior is a PDF (print takes
 * PDF only, whatever the browser sent), finds the server's own record of the print
 * file check for exactly these files, and - when the edition is being sent for
 * review - refuses unless that check passed. Returns what to save on the book.
 */
export async function gatePrintEdition(opts: {
  userId: string;
  interiorFileId: string | undefined;
  coverImageUrl: string | undefined;
  metadata: PrintMeta;
  existingMetadata?: PrintMeta | null;
  requirePass: boolean;
}): Promise<{ ok: true; saved: SavedPreflight | null } | { ok: false; error: string }> {
  const m = opts.metadata;
  if (!opts.interiorFileId) {
    return opts.requirePass ? { ok: false, error: "Upload the print-ready interior PDF before sending the print edition for review." } : { ok: true, saved: null };
  }
  const file = await prisma.uploadedFile.findUnique({ where: { id: opts.interiorFileId }, select: { mimeType: true, originalName: true } });
  if (!file || file.mimeType !== "application/pdf") {
    return { ok: false, error: "The print interior must be a PDF. Export your book as a PDF and upload that." };
  }

  const packages = packagesFor({
    trimCode: m.trimSizeCode ?? "",
    paperbackEnabled: !!m.paperbackEnabled,
    hardcoverEnabled: !!m.hardcoverEnabled,
    paperbackBinding: m.paperbackEnabled ? (m.binding || "PB") : "PB",
    interiorColor: m.interiorColor || "BW",
    printQuality: m.printQuality || "STD",
    paperType: m.paperType || "060UW444",
    coverFinish: m.coverFinish || "M",
    linenColor: m.linenColor || "X",
    foilColor: m.foilColor || "X",
  });
  const keys = {
    interiorFileId: opts.interiorFileId,
    coverKey: coverKeyFor({
      customCoverFileId: m.backCoverMode === "custom" ? m.customBackCoverPdfFileId : undefined,
      frontCoverImageUrl: m.frontCoverImageUrl || opts.coverImageUrl,
    }),
    packageIds: packageKey(packages.map((p) => p.packageId)),
  };

  const latestRow = await prisma.printPreflightCheck.findFirst({
    where: { userId: opts.userId, interiorFileId: keys.interiorFileId, coverKey: keys.coverKey, packageIds: keys.packageIds },
    orderBy: { createdAt: "desc" },
  });
  const latest = latestRow
    ? { id: latestRow.id, status: latestRow.status, createdAt: latestRow.createdAt, reasons: reasonsOf(latestRow.siteIssues, latestRow.luluJobs) }
    : null;

  const decision = decidePreflightGate({ keys, latest, saved: opts.existingMetadata?.printPreflight ?? null, requirePass: opts.requirePass });
  if (!decision.ok) return { ok: false, error: decision.error };
  return { ok: true, saved: decision.save };
}

function reasonsOf(siteIssues: unknown, luluJobs: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(siteIssues)) for (const i of siteIssues as { message?: string; fix?: string }[]) if (i?.message) out.push(`${i.message} ${i.fix ?? ""}`.trim());
  if (Array.isArray(luluJobs)) for (const j of luluJobs as { state?: string; kind?: string; errors?: string[] }[]) if (j?.state === "failed") for (const e of j.errors ?? []) out.push(`Lulu (${j.kind}): ${e}`);
  return out;
}

/** Links a saved check to the book it ended up on (so admin can trace it). */
export async function attachCheckToBook(checkId: string | undefined, bookId: string): Promise<void> {
  if (!checkId) return;
  await prisma.printPreflightCheck.updateMany({ where: { id: checkId }, data: { bookId } }).catch(() => {});
}
