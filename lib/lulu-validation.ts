/**
 * Pure helpers for Lulu's file validation service (validate-interior and
 * validate-cover). These services only inspect a file at a public URL and report
 * back - they never create a print job or an order. Validation is asynchronous:
 * a POST starts it and returns an id, and a GET on that id reports a status:
 *
 *   interior: NULL -> VALIDATING -> VALIDATED  (with a package id: -> NORMALIZING -> NORMALIZED)
 *   cover:    NULL -> NORMALIZING -> NORMALIZED
 *   either:   ERROR (with an `errors` list)
 */

export type LuluValidationState = "running" | "passed" | "failed";

export interface ParsedLuluValidation {
  /** Lulu's own status word, upper-cased. */
  status: string;
  state: LuluValidationState;
  /** Lulu's error messages, flattened to plain strings. */
  errors: string[];
}

/** Lulu may repeat the file address in an error. The staging bypass secret that can be on it is removed before anything is kept or shown. */
export function scrubSecrets(text: string): string {
  return text.replace(/([?&]x-vercel-protection-bypass=)[^&\s'"]*/gi, "$1[hidden]");
}

function flattenErrors(value: unknown, out: string[] = []): string[] {
  if (value == null) return out;
  if (typeof value === "string") { if (value.trim()) out.push(scrubSecrets(value.trim())); return out; }
  if (Array.isArray(value)) { for (const v of value) flattenErrors(v, out); return out; }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const msg = o.message ?? o.error ?? o.detail ?? o.description;
    if (typeof msg === "string" && msg.trim()) { out.push(scrubSecrets(msg.trim())); return out; }
    for (const v of Object.values(o)) flattenErrors(v, out);
    return out;
  }
  out.push(scrubSecrets(String(value)));
  return out;
}

/** Reads a validate-interior / validate-cover response. `withPackage` is true when a
 * package id was sent, in which case the finished state is NORMALIZED. */
export function parseLuluValidation(json: unknown, kind: "interior" | "cover"): ParsedLuluValidation {
  const o = (json ?? {}) as { status?: unknown; errors?: unknown; error?: unknown; detail?: unknown };
  const status = String(o.status ?? "").toUpperCase();
  const errors = flattenErrors(o.errors ?? o.error ?? o.detail);
  if (status === "ERROR") return { status, state: "failed", errors };
  if (status === "NORMALIZED") return { status, state: "passed", errors };
  // An interior that finished plain validation (sent without a package) is a pass too.
  if (status === "VALIDATED" && kind === "interior") return { status, state: "passed", errors };
  // A response with errors but no recognised status is a failure rather than "still running".
  if (errors.length > 0 && !["NULL", "VALIDATING", "NORMALIZING", "VALIDATED", ""].includes(status)) return { status, state: "failed", errors };
  return { status, state: "running", errors };
}

/** True when Lulu's message says it could not download the file from our address ("Failed to fetch from the source
 * URL ... received a 500 status code"). That is a problem on OUR side, never a problem in the author's file. */
export function isSiteFetchError(raw: string): boolean {
  const t = raw.toLowerCase();
  return t.includes("failed to fetch") || t.includes("source url") || /received an? \d{3} status/.test(t)
    // "not a valid PDF" is only ever shown for files that our own checks already opened as real PDFs (an unreadable one stops
    // before Lulu is asked), so it means Lulu was handed something else, such as a sign-in page, instead of the file.
    || /not a valid pdf/.test(t)
    || t.includes("unable to retrieve") || t.includes("could not retrieve") || t.includes("not accessible") || t.includes("unable to download") || t.includes("could not download");
}

/** Lulu's wording turned into something an author can act on. Unknown messages are
 * shown as Lulu wrote them, after a plain lead-in. */
export function explainLuluError(raw: string): { message: string; fix: string } {
  const t = raw.toLowerCase();
  if (t.includes("font") && (t.includes("embed") || t.includes("not embedded"))) {
    return { message: "Lulu reports that the fonts in your PDF are not embedded.", fix: "Re-export your PDF with fonts embedded (choose a PDF/X-1a or \"Press quality\" export), then upload it again." };
  }
  if (t.includes("book size") || (t.includes("page") && t.includes("size")) || t.includes("trim")) {
    return { message: "Lulu reports that the page size does not match the trim size chosen for this book.", fix: "Re-export the PDF at exactly the trim size you chose (or the trim size plus 0.125 in bleed) and upload it again." };
  }
  if (t.includes("page count") || t.includes("number of pages") || t.includes("too few pages") || t.includes("too many pages")) {
    return { message: "Lulu reports that the number of pages is not valid for this binding.", fix: "Change the number of pages (or the binding) so it is within Lulu's limits, then upload the PDF again." };
  }
  if (t.includes("cover") && (t.includes("dimension") || t.includes("size") || t.includes("width") || t.includes("height"))) {
    return { message: "Lulu reports that the cover is not the right size for this book.", fix: "Re-export the full wraparound cover (back + spine + front, with bleed) at the size shown, or remove the custom cover and use your front cover image." };
  }
  if (t.includes("encrypt") || t.includes("password")) {
    return { message: "Lulu reports that the PDF is password-protected.", fix: "Export the PDF again without a password and upload it." };
  }
  if (t.includes("transparen")) {
    return { message: "Lulu reports that the PDF uses transparency it cannot print.", fix: "Flatten transparency when exporting (PDF/X-1a does this) and upload the file again." };
  }
  if (isSiteFetchError(raw)) {
    return { message: "The check could not be completed because of a problem on our side: Lulu could not download your file from our site. Nothing is wrong with your file.", fix: "We try again automatically. If this message stays, tell support." };
  }
  return { message: `Lulu's file check reported: "${raw}"`, fix: "Fix this in the file and upload it again. If you are not sure how, send the message above to support." };
}
