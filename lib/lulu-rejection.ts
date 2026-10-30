/**
 * What Lulu said when it turned a print job down, and what the author should do about it.
 * Pure text rules, no database or network, so they can be tested.
 */

/** Lulu's status words that mean "Lulu refused this job". Cancelled jobs are shown but the author is not told. */
export function isRejectedStatus(status: string | null | undefined): boolean {
  return (status ?? "").toUpperCase() === "REJECTED";
}

function readMessages(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (Array.isArray(v)) return v.flatMap(readMessages);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return [...readMessages(o.message), ...readMessages(o.messages), ...readMessages(o.detail), ...readMessages(o.errors)];
  }
  return [];
}

/** The reason Lulu gave on a print job (GET /print-jobs/{id}): status.message and status.messages. */
export function reasonFromPrintJob(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const status = (json as Record<string, unknown>).status;
  const msgs = [...new Set(readMessages(status))];
  return msgs.length ? msgs.join("; ").slice(0, 3800) : null;
}

const FILE_WORDS = /(cover|interior|pdf|page count|pages|trim|bleed|spine|margin|font|resolution|file|dimension|size)/i;

export interface FailureClass {
  /** Lulu (or the file check) turned the job down for something the author can fix. */
  rejected: boolean;
  /** The reason, in Lulu's own words where there are any. */
  reason: string;
}

/** Sorts a "could not send to Lulu" error into: an author-fixable rejection, or something else (address,
 * credentials, network ...) that the author has no part in. */
export function classifyFailure(message: string | null | undefined): FailureClass {
  const text = (message ?? "").trim();
  if (!text) return { rejected: false, reason: "" };
  // Lulu answered the print job with a 4xx and said why.
  const m = text.match(/^Lulu print job failed \((4\d\d)\)[^:]*:\s*([\s\S]*)$/);
  if (m) {
    let body = m[2].trim();
    try {
      const parsed = JSON.parse(body);
      const found = readMessages(parsed);
      if (found.length) body = found.join("; ");
      else {
        const flat = Object.entries(parsed as Record<string, unknown>).flatMap(([k, v]) => readMessages(v).map((x) => `${k}: ${x}`));
        if (flat.length) body = flat.join("; ");
      }
    } catch { /* not JSON: keep the text as Lulu sent it */ }
    return { rejected: m[1] !== "401" && m[1] !== "403" && FILE_WORDS.test(body), reason: body.slice(0, 3800) };
  }
  // Our own check of the author's files before sending (missing cover/interior, cover could not be built).
  if (/^Not sent to Lulu —/.test(text) && /(cover|interior|manuscript)/i.test(text) && !/(recipient|street|city|postal|country|email is missing|state\/province)/i.test(text) && !/(Lulu could not|Lulu returned an unusable|authentication|credentials)/i.test(text)) {
    return { rejected: true, reason: text.replace(/^Not sent to Lulu — /, "").replace(/\.$/, "") };
  }
  return { rejected: false, reason: text.slice(0, 1900) };
}

/** A short plain-language "what to fix", chosen from the words in Lulu's reason. */
export function fixHint(reason: string): string {
  const r = reason.toLowerCase();
  const steps: string[] = [];
  if (/cover|spine|bleed/.test(r)) steps.push("replace the cover file with one that matches the cover guides shown in the Print tab (full wrap, correct size, artwork inside the margins)");
  if (/interior|page count|pages|margin|font|resolution|trim/.test(r) || /manuscript/.test(r)) steps.push("replace the interior PDF with a print-ready one (page size equal to the trim size, fonts embedded, an even page count)");
  if (steps.length === 0) steps.push("check the files in the Print tab and upload corrected ones");
  return `Please ${steps.join(", and ")}. Open the book, choose the Print tab, and upload the corrected file; it is checked with Lulu again automatically.`;
}
