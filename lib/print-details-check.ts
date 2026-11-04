/**
 * Is a printed book's detail record complete enough for a shipping price to be asked for it quickly and reliably?
 * Pure, so the admin Books table, the Lulu Publishing tab and the checkout log all say the same thing.
 *
 *  - "error": a price CANNOT be asked (no page count and no interior file to count the pages from).
 *  - "warning": a price can be asked, but the site has to open the whole interior PDF on every request to find the page count or
 *    size (slow, and the likely cause of a first checkout attempt stalling).
 */
export interface PrintDetailsProblem { level: "error" | "warning"; message: string }

export function printDetailsProblems(opts: { submissionMetadata: unknown; hasInteriorFile: boolean; hasPrintFormat: boolean }): PrintDetailsProblem[] {
  if (!opts.hasPrintFormat) return [];
  const m = (opts.submissionMetadata as { pages?: unknown; trimSizeCode?: unknown } | null) ?? {};
  const pages = Number(m.pages) || 0;
  const trim = typeof m.trimSizeCode === "string" ? m.trimSizeCode : "";
  const out: PrintDetailsProblem[] = [];
  if (!pages && !opts.hasInteriorFile) out.push({ level: "error", message: "No page count and no interior file: a printing price cannot be asked for this book." });
  else if (!pages) out.push({ level: "warning", message: "The page count is not saved on the book, so the interior PDF is opened on every price request (slow)." });
  if (!trim) out.push({ level: opts.hasInteriorFile ? "warning" : "error", message: opts.hasInteriorFile ? "The trim size is not saved on the book, so it is guessed from the PDF on every price request (slow)." : "No trim size saved and no interior file to read it from." });
  return out;
}

export const worstLevel = (p: PrintDetailsProblem[]): "error" | "warning" | null => (p.some((x) => x.level === "error") ? "error" : p.length ? "warning" : null);
