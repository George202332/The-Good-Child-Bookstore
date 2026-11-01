import { LULU_CONFIG, labelForCode } from "@/lib/lulu-config";

export interface PrintOptionsInput {
  format: "paperback" | "hardcover";
  pageCount?: number;
  trimCode: string;
  binding: string;
  paperCode: string;
  colorCode: string;
  qualityCode: string;
  finishCode: string;
  linenCode?: string;
  foilCode?: string;
}

/**
 * The options behind a printing cost, in plain words, so an author can see why a Hardcover costs more than a
 * Paperback. Linen wrap colour and foil stamp colour only appear for a hardcover and only when one is chosen.
 */
export function printOptionsSummary(o: PrintOptionsInput): string[] {
  const parts: string[] = [];
  if (o.pageCount && o.pageCount > 0) parts.push(`${o.pageCount} pages`);
  parts.push(labelForCode(LULU_CONFIG.trimSizes, o.trimCode));
  parts.push(o.format === "hardcover" ? labelForCode(LULU_CONFIG.bindings, "LW") : labelForCode(LULU_CONFIG.bindings, o.binding));
  parts.push(labelForCode(LULU_CONFIG.paperTypes, o.paperCode));
  parts.push(`${labelForCode(LULU_CONFIG.interiorColors, o.colorCode)} interior`);
  parts.push(`${labelForCode(LULU_CONFIG.printQualities, o.qualityCode)} print quality`);
  parts.push(`${labelForCode(LULU_CONFIG.coverFinishes, o.finishCode)} cover finish`);
  if (o.format === "hardcover") {
    if (o.linenCode && o.linenCode !== "X") parts.push(`${labelForCode(LULU_CONFIG.linenColors, o.linenCode)} linen wrap`);
    if (o.foilCode && o.foilCode !== "X") parts.push(`${labelForCode(LULU_CONFIG.foilColors, o.foilCode)} foil stamp`);
  }
  return parts;
}
