import { estimatePrintingCost } from "@/lib/lulu-pricing";
import { packagesFor } from "@/lib/print-preflight-packages";
import { checkPriceFloor, trimLabel } from "@/lib/print-specs";
import { quotePrintingCostPerCopy } from "@/lib/payments/lulu";

interface PriceMeta {
  pages?: number; trimSizeCode?: string; paperbackEnabled?: boolean; hardcoverEnabled?: boolean; binding?: string;
  interiorColor?: string; printQuality?: string; paperType?: string; coverFinish?: string; linenColor?: string; foilColor?: string;
  paperbackRetailPrice?: number; hardcoverRetailPrice?: number;
}

/**
 * The server's own price-floor check for a print edition, run when it is sent for review, so the
 * browser cannot skip it. Each enabled format's price must cover Lulu's printing cost for the book's
 * exact specifications and leave the author at least the minimum royalty (lib/print-specs.ts).
 * Uses Lulu's live quote; only when Lulu cannot be asked does it use the site's estimate.
 * Returns the problem in plain words, or null when the prices are fine.
 */
export async function printPriceProblem(m: PriceMeta): Promise<string | null> {
  const pageCount = Number(m.pages) || 0;
  if (!pageCount || !m.trimSizeCode) return null; // no file details yet: the print file check covers that
  const packages = packagesFor({
    trimCode: m.trimSizeCode,
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
  const problems: string[] = [];
  for (const p of packages) {
    const label = p.format === "hardcover" ? "Hardcover" : "Paperback";
    const retail = Number(p.format === "hardcover" ? m.hardcoverRetailPrice : m.paperbackRetailPrice) || 0;
    const q = await quotePrintingCostPerCopy(p.packageId, pageCount);
    if (!q.ok && q.rejected) { problems.push(`${label}: Lulu does not offer ${trimLabel(m.trimSizeCode)} with these settings at ${pageCount} pages.`); continue; }
    const cost = q.ok ? q.cost : estimatePrintingCost(p.bindingCode as "PB" | "CO" | "LW", pageCount);
    const r = checkPriceFloor(retail, cost, label);
    if (!r.ok && r.message) problems.push(r.message);
  }
  return problems.length ? problems.join(" ") : null;
}
