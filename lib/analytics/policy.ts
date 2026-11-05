/**
 * Analytics rules in one pure file (no browser, no database), so the same rules are used by the cookie notice, the
 * tracking helper, the event receiver and the tests.
 *
 *  - Analytics is OFF until the visitor accepts (worldwide, no exceptions).
 *  - Analytics tags and counters never run on private pages: admin, checkout, account, library, author dashboard.
 *  - Only the live site (VERCEL_ENV === "production") ever loads Google or stores a count. Decided here, in code.
 *  - Nothing personal is ever sent: no names, e-mails, order contents, IP addresses or account ids.
 */

export const CONSENT_COOKIE = "gcb_consent";
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export type ConsentStatus = "granted" | "denied" | "unset";

/** Prefixes where no analytics tag may load and no page view is counted. */
export const PRIVATE_PREFIXES = ["/admin", "/investor", "/checkout", "/cart", "/account", "/library", "/login", "/signup", "/api"] as const;

export function isPrivatePath(pathname: string | null | undefined): boolean {
  const p = (pathname || "/").split("?")[0].split("#")[0];
  return PRIVATE_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));
}

/** Google tags and first-party counters exist only on the live site. */
export function analyticsEnabledFor(vercelEnv: string | undefined = process.env.VERCEL_ENV): boolean {
  return vercelEnv === "production";
}

export function parseConsent(cookieHeader: string | null | undefined): ConsentStatus {
  if (!cookieHeader) return "unset";
  const m = cookieHeader.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${CONSENT_COOKIE}=`));
  const v = m ? m.slice(CONSENT_COOKIE.length + 1) : "";
  return v === "granted" || v === "denied" ? v : "unset";
}

export const EVENT_NAMES = ["page_view", "book_view", "add_to_cart", "checkout_started", "purchase", "blog_to_book"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Static site pages that are not books, so a blog link to one of them is not counted as "blog to book". */
const RESERVED_SEGMENTS = new Set([
  "blog", "about", "contact", "authors", "affiliate", "subscription", "faq", "privacy", "terms", "returns", "bookshelf",
  "login", "signup", "checkout", "cart", "account", "admin", "browse", "investor", "api", "forgot-password", "reset-password",
]);

/** A site path that is a book page: /book/<id> or /<slug>. */
export function isBookPath(path: string): boolean {
  const p = path.split("?")[0].split("#")[0].replace(/\/+$/, "");
  if (/^\/book\/[^/]+$/.test(p)) return true;
  const m = /^\/([a-z0-9][a-z0-9-]*)$/i.exec(p);
  return !!m && !RESERVED_SEGMENTS.has(m[1].toLowerCase());
}

export type TrafficSource = "Direct" | "Search" | "Social" | "Email" | "Other websites";

const SEARCH = ["google.", "bing.", "duckduckgo.", "yahoo.", "baidu.", "yandex.", "ecosia.", "brave.", "startpage."];
const SOCIAL = ["facebook.", "instagram.", "twitter.", "x.com", "t.co", "linkedin.", "pinterest.", "tiktok.", "youtube.", "reddit.", "whatsapp.", "threads.", "telegram."];

/** Where a visit came from, from the referrer host and the utm_medium tag only. Never stores the full address. */
export function classifySource(referrerHost: string | null | undefined, ownHost: string | null | undefined, utmMedium?: string | null): TrafficSource {
  const medium = (utmMedium || "").toLowerCase();
  if (medium === "email" || medium === "newsletter") return "Email";
  if (medium === "social") return "Social";
  if (medium === "cpc" || medium === "organic") return "Search";
  const h = (referrerHost || "").toLowerCase().replace(/^www\./, "");
  if (!h) return "Direct";
  const own = (ownHost || "").toLowerCase().replace(/^www\./, "");
  if (own && (h === own || h.endsWith(`.${own}`))) return "Direct";
  if (SEARCH.some((s) => h.includes(s))) return "Search";
  if (SOCIAL.some((s) => h === s || h.includes(s))) return "Social";
  return "Other websites";
}

const clip = (s: unknown, n: number): string => String(s ?? "").replace(/[^\w\-./: ]+/g, "").slice(0, n);

export interface CleanEvent { name: EventName; data: Record<string, string | number> }

/** Keeps only the fields each event is allowed to carry, as short plain text. Anything else is dropped. */
export function sanitizeEvent(input: unknown): CleanEvent | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const name = o.name as EventName;
  if (!EVENT_NAMES.includes(name)) return null;
  const d = (o.data && typeof o.data === "object" ? o.data : {}) as Record<string, unknown>;
  const out: Record<string, string | number> = {};
  const put = (k: string, n = 120) => { const v = clip(d[k], n); if (v) out[k] = v; };
  switch (name) {
    case "page_view": put("path", 160); put("source", 20); break;
    case "book_view": put("bookId", 60); put("blogSlug", 120); put("source", 20); break;
    case "add_to_cart": put("bookId", 60); put("format", 20); put("blogSlug", 120); break;
    case "checkout_started": put("blogSlug", 120); put("bookIds", 300); { const n = Number(d.items); if (Number.isFinite(n) && n >= 0 && n < 1000) out.items = Math.floor(n); } break;
    case "purchase": put("orderId", 60); put("blogSlug", 120); break;
    case "blog_to_book": put("blogSlug", 120); put("target", 160); break;
  }
  if (name === "page_view" && !out.path) return null;
  if (name === "purchase" && !out.orderId) return null;
  if (name === "blog_to_book" && (!out.blogSlug || !out.target)) return null;
  // Private pages never send page views.
  if (name === "page_view" && isPrivatePath(String(out.path))) return null;
  return { name, data: out };
}
