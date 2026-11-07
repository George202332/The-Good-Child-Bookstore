/**
 * Pure helpers for the print book's detected specifications and its price floor.
 * No network and no database, so everything here is unit tested.
 */
import { LULU_CONFIG } from "@/lib/lulu-config";
import { checkPageCount, checkPageSizes, type PreflightIssue } from "@/lib/print-preflight";
import { formatInches, trimCodeToInches } from "@/lib/trim-size";
import { calculateSplits } from "@/lib/revenue";

export const trimLabel = (code: string) => LULU_CONFIG.trimSizes.find((t) => t.code === code)?.label ?? code;

/** The trim sizes nearest to a page size, for telling the author what the file is closest to. */
export function closestTrims(widthIn: number, heightIn: number, count = 2): { code: string; label: string }[] {
  return LULU_CONFIG.trimSizes
    .map((t) => {
      const d = trimCodeToInches(t.code);
      return { code: t.code, label: t.label, dist: d ? Math.abs(d.w - widthIn) + Math.abs(d.h - heightIn) : Infinity };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
    .map(({ code, label }) => ({ code, label }));
}

export function unsupportedSizeMessage(widthIn: number, heightIn: number): string {
  const near = closestTrims(widthIn, heightIn).map((t) => t.label).join(" or ");
  return `Your pages are ${formatInches(widthIn, heightIn)}, which is not a size Lulu prints. The closest sizes are ${near}. Re-export the interior at exactly one of the sizes in the list (or the size plus 0.125 in bleed) and upload it again.`;
}

export interface TrimEvaluation {
  code: string;
  label: string;
  /** True only when the site's checks pass and (if Lulu was asked) Lulu offers the size at this page count. */
  passes: boolean;
  /** Plain-language reasons it does not pass. */
  problems: string[];
  /** Did Lulu accept this size and page count? null when Lulu could not be asked. */
  luluAccepts: boolean | null;
}

/** One trim size judged against the file: the page size, the page count for every binding, and Lulu's answer. */
export function evaluateTrim(opts: {
  trimCode: string;
  pages: { widthIn: number; heightIn: number }[];
  pageCount: number;
  bindingCodes: string[];
  luluAccepts: boolean | null;
}): TrimEvaluation {
  const problems: string[] = [];
  const size = checkPageSizes(opts.pages, opts.trimCode);
  if (size) problems.push(size.message);
  for (const b of opts.bindingCodes) {
    const pc: PreflightIssue | null = checkPageCount(opts.pageCount, b);
    if (pc && !problems.includes(pc.message)) problems.push(pc.message);
  }
  if (opts.luluAccepts === false) problems.push(`Lulu does not offer ${trimLabel(opts.trimCode)} with these settings at ${opts.pageCount} pages.`);
  return { code: opts.trimCode, label: trimLabel(opts.trimCode), passes: problems.length === 0, problems, luluAccepts: opts.luluAccepts };
}

/** "Best option": the file's own size against the size the author has selected, in plain words. */
export function recommendTrim(detected: TrimEvaluation | null, chosen: TrimEvaluation): { recommendedCode: string | null; message: string } {
  if (!detected) {
    return { recommendedCode: null, message: chosen.passes ? `${chosen.label} passes.` : `${chosen.label} does not pass: ${chosen.problems.join(" ")}` };
  }
  if (detected.code === chosen.code) {
    return detected.passes
      ? { recommendedCode: detected.code, message: `${detected.label} (read from your file) passes the checks.` }
      : { recommendedCode: null, message: `${detected.label} was read from your file, but it does not pass: ${detected.problems.join(" ")}` };
  }
  if (detected.passes && !chosen.passes) {
    return { recommendedCode: detected.code, message: `The size you selected (${chosen.label}) would fail: ${chosen.problems.join(" ")} The size read from your file (${detected.label}) passes, so we recommend ${detected.label}.` };
  }
  if (detected.passes && chosen.passes) {
    return { recommendedCode: detected.code, message: `Both ${detected.label} (read from your file) and ${chosen.label} pass the checks. We recommend ${detected.label}, because it matches the file exactly.` };
  }
  if (!detected.passes && chosen.passes) {
    return { recommendedCode: chosen.code, message: `${chosen.label} passes. The size read from your file (${detected.label}) does not: ${detected.problems.join(" ")}` };
  }
  return { recommendedCode: null, message: `Neither size passes. ${detected.label} (read from your file): ${detected.problems.join(" ")} ${chosen.label} (selected): ${chosen.problems.join(" ")}` };
}

// ---------------------------------------------------------------------------
// Price floor
// ---------------------------------------------------------------------------

/** The least the company must keep on every copy (its 30% of the balance: retail price minus Lulu's printing cost).
 * Publishing a print edition is blocked below it, in the form and again on the server. Change it here only. */
export const MIN_COMPANY_SHARE = { paperback: 3, hardcover: 2 } as const;
export type PrintFormat = keyof typeof MIN_COMPANY_SHARE;

/** The company's share of one copy at this price, worked out by the same split engine real sales use. */
export function companyShareAt(retail: number, printingCost: number): number {
  return calculateSplits(retail, false, undefined, printingCost).companyShare;
}

/** The lowest retail price (to the cent) at which the company's share reaches the minimum for this format. */
export function minimumRetailPrice(printingCost: number, format: PrintFormat): number {
  const need = MIN_COMPANY_SHARE[format];
  // The balance (price minus printing cost) must reach need / 0.30 ($10.00 Paperback, $6.67 Hardcover rounded up), so the
  // price is the printing cost plus that balance, to the next cent. The split engine's own figure is checked as well.
  const balanceCents = Math.ceil(Math.round((need / 0.3) * 1e6) / 1e4);
  let cents = Math.round(printingCost * 100) + balanceCents;
  for (let i = 0; i < 1000; i++) {
    if (companyShareAt(cents / 100, printingCost) >= need) return cents / 100;
    cents += 1;
  }
  return cents / 100;
}

export interface PriceFloorResult {
  ok: boolean;
  minimum: number;
  /** Plain-language reason, only when not ok. */
  message?: string;
}

export function checkPriceFloor(retail: number, printingCost: number, format: PrintFormat): PriceFloorResult {
  const minimum = minimumRetailPrice(printingCost, format);
  if (Number.isFinite(retail) && retail >= minimum) return { ok: true, minimum };
  const label = format === "hardcover" ? "Hardcover" : "Paperback";
  return {
    ok: false,
    minimum,
    message: `${label}: this edition cannot be published below $${minimum.toFixed(2)}. At that price the company keeps at least $${MIN_COMPANY_SHARE[format].toFixed(2)} on every copy after Lulu's printing cost of $${printingCost.toFixed(2)}.`,
  };
}
