/**
 * Personal Message: a short dedication a buyer can add to a PRINTED copy (Paperback or Hardcover), printed on one blank page near
 * the front of that copy. Pure helpers (no database), shared by the product page, cart, checkout, the server and the tests.
 */

export const PERSONAL_MESSAGE_MAX = 200;
export const PERSONAL_MESSAGE_DEFAULT_PAGE = 3;

export interface PersonalMessageStyle { id: string; label: string; css: string }
/** The simple styles offered. Each maps to an embeddable font family used for the preview and the printed page. */
export const PERSONAL_MESSAGE_STYLES: PersonalMessageStyle[] = [
  { id: "classic", label: "Classic", css: "Georgia, 'Times New Roman', serif" },
  { id: "script", label: "Elegant Italic", css: "Georgia, 'Times New Roman', serif; font-style: italic" },
  { id: "simple", label: "Simple", css: "Arial, Helvetica, sans-serif" },
];
export const DEFAULT_STYLE_ID = "classic";
export const isStyleId = (s: unknown): s is string => typeof s === "string" && PERSONAL_MESSAGE_STYLES.some((x) => x.id === s);

/** The line the author set up, read from a book's saved print details. */
export interface PersonalMessageSetup { enabled: boolean; page: number; defaultLine: string }
export function personalMessageSetup(meta: unknown): PersonalMessageSetup {
  const m = (meta && typeof meta === "object" ? meta : {}) as Record<string, unknown>;
  const page = typeof m.personalMessagePage === "number" && m.personalMessagePage >= 1 ? Math.round(m.personalMessagePage) : PERSONAL_MESSAGE_DEFAULT_PAGE;
  return {
    enabled: m.personalMessageEnabled === true,
    page,
    defaultLine: typeof m.personalMessageDefaultLine === "string" ? m.personalMessageDefaultLine.slice(0, 80) : "",
  };
}

/** Only printed copies can carry a message. */
export function canPersonalise(format: string | null | undefined): boolean {
  return format === "paperback" || format === "hardcover";
}

/** Trims, collapses whitespace runs and caps the length. Returns "" when nothing is left. */
export function cleanMessage(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, PERSONAL_MESSAGE_MAX);
}

// ---------- the automatic check ----------

/**
 * Words and phrases that always hold a message for a person to look at. This is a first filter, never the last word: a flagged
 * message is only HELD, and a reviewer decides. Letters are normalised first (so "f.u.c.k", "fuuuck" or "f*ck" are caught).
 */
const BLOCKED: string[] = [
  "fuck", "shit", "bitch", "bastard", "asshole", "cunt", "dick", "pussy", "whore", "slut", "nigger", "nigga", "faggot", "retard",
  "rape", "rapist", "kill yourself", "kys", "go die", "i hate you", "hate you", "die", "murder", "suicide", "terrorist", "nazi", "hitler",
  "porn", "sex", "nude", "naked", "bomb", "isis", "cocaine", "heroin", "damn you", "stupid", "idiot", "moron", "ugly", "fat pig",
];
// Short or common-looking words are matched as whole words only, to avoid flagging "Dickens", "assistant" or "diet".
const WHOLE_WORD_ONLY = new Set(["die", "sex", "dick", "kys", "bomb", "isis", "nude", "naked", "ugly", "stupid", "idiot", "moron", "porn", "rape", "hate you"]);

export function normaliseForCheck(text: string): string {
  const map: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };
  const lower = text.toLowerCase().replace(/[01345 7@$]/g, (c) => (c === " " ? " " : map[c] ?? c));
  const folded = lower.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return folded.replace(/(.)\1{2,}/g, "$1$1").replace(/[^a-z\s*.\-_]/g, " ");
}

export interface MessageCheck { flagged: boolean; reasons: string[] }
export function checkMessage(text: string): MessageCheck {
  const reasons: string[] = [];
  if (!text.trim()) return { flagged: false, reasons };
  const norm = normaliseForCheck(text);
  const stripped = norm.replace(/[*.\-_]/g, "");
  const words = new Set(stripped.split(/\s+/).filter(Boolean));
  const hits = new Set<string>();
  for (const term of BLOCKED) {
    if (WHOLE_WORD_ONLY.has(term)) {
      if (term.includes(" ") ? ` ${stripped} `.includes(` ${term} `) : words.has(term)) hits.add(term);
    } else if (stripped.includes(term.replace(/\s/g, "")) || stripped.includes(term)) {
      hits.add(term);
    }
  }
  if (hits.size > 0) reasons.push("Contains words that may be offensive or unsuitable");
  if (/https?:\/\/|www\.|\.com\b|\.net\b|\.org\b|\.co\.\w\w\b/i.test(text)) reasons.push("Contains a web address");
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) reasons.push("Contains an e-mail address");
  if (/(?:\+?\d[\s().-]*){9,}/.test(text)) reasons.push("Contains a phone number");
  if (/(.)\1{9,}/.test(text) || /[^\p{L}\p{N}\s.,'’"!?;:()\-–—&%+/\n]{6,}/u.test(text)) reasons.push("Looks like random characters");
  return { flagged: reasons.length > 0, reasons };
}

// ---------- fee ----------

export const PERSONAL_MESSAGE_FEE_MAX = 20;
export function isValidFee(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= PERSONAL_MESSAGE_FEE_MAX;
}
/** The fee for an order: charged once per personalised printed line (not per copy). Zero when nothing is personalised. */
export function feeForOrder(personalisedLines: number, feePerLine: number): number {
  if (!(personalisedLines > 0) || !(feePerLine > 0)) return 0;
  return Math.round(personalisedLines * feePerLine * 100) / 100;
}

/** Plain-words status for the buyer. */
export function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case "HELD": return "Waiting for a quick check";
    case "REJECTED": return "Not accepted";
    case "APPROVED": case "CLEAR": return "Approved";
    default: return "";
  }
}
