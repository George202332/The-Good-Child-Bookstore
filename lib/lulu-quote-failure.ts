/**
 * Why a Lulu price request (the cost calculator or the shipping-options list) did not give a price, and what the
 * customer should be told. Pure, so the wording and the retry rule are tested.
 *
 * Until now every failure was shown as one vague line ("try again in a moment") and the reason Lulu gave was thrown
 * away. Each failure is now sorted into one of these kinds, the kind decides whether asking again can help, and the
 * customer is shown an honest message for it. Nothing here ever contains a key or a secret: only the HTTP status and
 * the short reason text Lulu itself returned.
 */

export type QuoteFailureKind =
  /** Lulu refused our credentials (wrong key for the Lulu system, or keys removed). A problem on our side. */
  | "auth"
  /** Lulu refused this delivery address (street, city, region, postal code, country or phone). */
  | "address"
  /** Lulu refused the book itself (the package / size / page count combination is not one it can print). */
  | "rejected"
  /** Lulu did not answer in time, was unreachable, or answered with a server error / "slow down". Asking again can help. */
  | "unavailable"
  /** Lulu answered, but not with a price we can read. */
  | "unreadable"
  /** The book's page count is not known, so a price cannot be asked for. */
  | "pages"
  /** No Lulu credentials are saved on this site. */
  | "not-configured";

export interface QuoteFailure {
  kind: QuoteFailureKind;
  status?: number;
  /** Lulu's own short reason, for the logs and the admin alert (never shown as a key; may be empty). */
  detail: string;
  /** What the customer is shown. */
  customerMessage: string;
  /** True only when asking again could give a different answer. */
  retryable: boolean;
}

/** The short reason in a Lulu error body: its `detail` / `message` / `errors`, else the first part of the text. */
export function shortLuluReason(body: string | null | undefined, max = 160): string {
  const text = (body ?? "").trim();
  if (!text) return "";
  let reason = text;
  try {
    const j = JSON.parse(text) as unknown;
    const pick = (v: unknown): string => {
      if (typeof v === "string") return v;
      if (Array.isArray(v)) return v.map(pick).filter(Boolean).join("; ");
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        for (const k of ["detail", "message", "error", "errors", "description"]) {
          const s = pick(o[k]);
          if (s) return s;
        }
        return Object.entries(o).map(([k, x]) => `${k}: ${pick(x)}`).filter((s) => !s.endsWith(": ")).join("; ");
      }
      return "";
    };
    reason = pick(j) || text;
  } catch {
    // not JSON: use the text as it is
  }
  reason = reason.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return reason.length > max ? `${reason.slice(0, max - 1)}…` : reason;
}

const ADDRESS_WORDS = /address|postcode|postal|zip|state|province|region|country|phone|city|street|shipping_address/i;

export function classifyQuoteFailure(input: {
  status?: number;
  body?: string;
  /** A network error or timeout message (no HTTP answer at all). */
  network?: string;
  unreadable?: boolean;
  pagesMissing?: boolean;
  notConfigured?: boolean;
}): QuoteFailure {
  const detail = input.network ? input.network.slice(0, 160) : shortLuluReason(input.body);
  const base = { status: input.status, detail };
  if (input.notConfigured) {
    return { ...base, kind: "not-configured", retryable: false, customerMessage: "Printed copies can't be priced right now because print ordering is not switched on for this store yet. Nothing has been charged. You can buy the eBook or audiobook instead." };
  }
  if (input.pagesMissing) {
    return { ...base, kind: "pages", retryable: false, customerMessage: "This printed book's page count is missing, so its printing price can't be worked out. Nothing has been charged. Our team has been alerted; you can buy the eBook or audiobook instead." };
  }
  if (input.network !== undefined || (input.status !== undefined && (input.status >= 500 || input.status === 429 || input.status === 408))) {
    return { ...base, kind: "unavailable", retryable: true, customerMessage: "Our print partner's price service is not answering right now. We tried several times. Nothing has been charged; please try again in a few minutes." };
  }
  if (input.status === 401 || input.status === 403) {
    return { ...base, kind: "auth", retryable: false, customerMessage: "Printed copies can't be priced right now because of a problem on our side. Nothing has been charged. Our team has been alerted; please try again later." };
  }
  if (input.unreadable) {
    return { ...base, kind: "unreadable", retryable: false, customerMessage: "Our print partner sent back a price we could not read. Nothing has been charged. Our team has been alerted; please try again later." };
  }
  if (input.status !== undefined && input.status >= 400) {
    const why = detail ? ` (Lulu said: ${detail})` : "";
    if (ADDRESS_WORDS.test(input.body ?? "")) {
      return { ...base, kind: "address", retryable: false, customerMessage: `Our print partner could not price this order for your delivery address${why}. Please check the street, city, region, postal code, country and phone number, then try again. Nothing has been charged.` };
    }
    return { ...base, kind: "rejected", retryable: false, customerMessage: `Our print partner could not price this printed book${why}. Nothing has been charged. Please contact us, or buy the eBook or audiobook instead.` };
  }
  return { ...base, kind: "unreadable", retryable: false, customerMessage: "Our print partner sent back a price we could not read. Nothing has been charged. Our team has been alerted; please try again later." };
}

/** Kinds that mean something is wrong on our side (not the customer's address): the team is alerted about these. */
export function needsTeamAlert(kind: QuoteFailureKind): boolean {
  return kind === "auth" || kind === "unreadable" || kind === "pages" || kind === "not-configured" || kind === "rejected";
}
