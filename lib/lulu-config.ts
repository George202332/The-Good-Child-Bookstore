/**
 * Real Lulu Print API configuration values, taken directly from the
 * original file's own LULU_CONFIG object (the-good-child-bookstore_54_1
 * .html:8384-8442) — trim sizes, ink/color, print quality, binding,
 * paper, and finish codes exactly as documented in Lulu's real
 * pod_package_id spec: [Trim].[Ink].[Quality].[Binding].[Paper].[Finish].
 *
 * This is the real configuration shape, used to build a genuine
 * pod_package_id string for a print submission — but it is not yet
 * wired to an actual Lulu API call (no LULU_API_KEY has real network
 * access to verify against in this environment), and the live cover-wrap
 * dimension preview / EAN-13 barcode rendering from the original aren't
 * built. That's real, separate follow-up work.
 */

export const LULU_CONFIG = {
  trimSizes: [
    { label: "5 x 8 in", code: "0500X0800" },
    { label: "5.5 x 8.5 in", code: "0550X0850" },
    { label: "6 x 9 in", code: "0600X0900" },
    { label: "8.5 x 11 in", code: "0850X1100" },
    { label: "8.27 x 11.69 in (A4)", code: "0827X1169" },
  ],
  interiorColors: [
    { label: "Black & White", code: "BW" },
    { label: "Full Color", code: "FC" },
  ],
  printQualities: [
    { label: "Standard", code: "STD" },
    { label: "Premium", code: "PRE" },
  ],
  bindings: [
    { label: "Perfect Bound (Paperback)", code: "PB", hardcover: false },
    { label: "Coil Bound", code: "CO", hardcover: false, maxPages: 275 },
    { label: "Linen Wrap (Hardcover)", code: "LW", hardcover: true },
  ],
  paperTypes: [
    { label: "60# White (Uncoated)", code: "060UW444" },
    { label: "60# Cream (Uncoated)", code: "060UC444" },
    { label: "80# White (Coated)", code: "080CW444" },
  ],
  coverFinishes: [
    { label: "Matte", code: "M" },
    { label: "Gloss", code: "G" },
  ],
  linenColors: [
    { label: "None (not Linen Wrap)", code: "X" },
    { label: "Navy", code: "N" },
    { label: "Gray", code: "G" },
    { label: "Red", code: "R" },
    { label: "Black", code: "B" },
    { label: "Tan", code: "T" },
    { label: "Forest", code: "F" },
  ],
  foilColors: [
    { label: "None", code: "X" },
    { label: "Gold", code: "G" },
    { label: "Black", code: "B" },
    { label: "White", code: "W" },
  ],
  foilStampMaxCombinedChars: 42,
};

export interface PrintConfig {
  trimCode: string;
  colorCode: string;
  qualityCode: string;
  bindingCode: string;
  paperCode: string;
  finishCode: string;
  linenCode: string;
  foilCode: string;
}

/** Ported exactly from buildPodPackageId() (the-good-child-bookstore_54_1.html:8447-8451). */
export function buildPodPackageId(cfg: PrintConfig): string {
  const isLinenWrap = cfg.bindingCode === "LW";
  const suffix = cfg.finishCode + (isLinenWrap ? cfg.linenCode || "X" : "X") + (isLinenWrap ? cfg.foilCode || "X" : "X");
  return `${cfg.trimCode}.${cfg.colorCode}.${cfg.qualityCode}.${cfg.bindingCode}.${cfg.paperCode}.${suffix}`;
}

/** Resolves a stored spec code (e.g. "BW", "STD") back to its readable
 * label (e.g. "Black & White", "Standard") from one of the LULU_CONFIG
 * option lists — falls back to the raw code if somehow not found. */
export function labelForCode(list: { code: string; label: string }[], code: string): string {
  return list.find((o) => o.code === code)?.label ?? code;
}
