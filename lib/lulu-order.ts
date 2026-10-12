/**
 * Pure helpers for building a Lulu print job (no network, no database), so
 * every rule that decides "will Lulu accept this order?" can be unit tested.
 * The network call and the database work live in lib/payments/lulu.ts.
 *
 * Lulu's Print API (POST /print-jobs/) needs, per its documentation:
 *  - a pod_package_id that is ONE string of at most 27 characters with no
 *    separators, e.g. 0600X0900BWSTDPB060UW444MXX;
 *  - absolute, publicly reachable cover and interior file URLs;
 *  - a complete shipping address: name, street1, city, postcode, a
 *    2-letter country_code, phone_number and email, plus state_code for the
 *    US, Canada, Australia and Mexico.
 */

export type LuluEnvironment = "sandbox" | "production";

/** Which Lulu system orders are sent to. Lulu runs two completely separate
 * systems with separate accounts and keys: the SANDBOX (test jobs that are
 * never printed or charged) and PRODUCTION (real printing, real charges).
 * An order sent to one never appears in the other.
 *
 * Order of precedence: the value chosen in Admin → API Management; then the
 * LULU_ENV environment variable; then the Paystack key mode ("live" →
 * production, "test" → sandbox), so real orders go to the real Lulu account
 * and test orders never print or charge. */
export function resolveLuluEnvironment(opts: {
  stored?: string | null;
  envVar?: string | null;
  paymentMode?: string | null;
}): LuluEnvironment {
  const pick = (v: string | null | undefined): LuluEnvironment | null => {
    const s = v?.trim().toLowerCase();
    if (s === "production" || s === "live") return "production";
    if (s === "sandbox" || s === "test") return "sandbox";
    return null;
  };
  return pick(opts.stored) ?? pick(opts.envVar) ?? (opts.paymentMode === "live" ? "production" : "sandbox");
}

export function luluBaseUrl(env: LuluEnvironment): string {
  return env === "production" ? "https://api.lulu.com" : "https://api.sandbox.lulu.com";
}

/** Lulu wants the pod_package_id as a single string with no separators
 * (max 27 characters). The submission form builds it with dots between the
 * parts for readability (lib/lulu-config.ts buildPodPackageId), so the dots
 * are removed here. */
export function toLuluPodPackageId(id: string): string {
  return id.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export const LULU_POD_PACKAGE_ID_MAX = 27;

/** Turns a stored path like "/api/files/abc" into an absolute URL Lulu can
 * download. Returns null for anything that can never be fetched (empty, or
 * an inline data: URL). */
export function absoluteFileUrl(url: string | null | undefined, siteUrl: string): string | null {
  const u = url?.trim();
  if (!u || u.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return `${siteUrl.replace(/\/+$/, "")}${u}`;
  return null;
}

// ---------------------------------------------------------------------------
// Shipping address
// ---------------------------------------------------------------------------

export interface ShipAddressParts {
  street: string;
  city: string;
  state?: string;
  postcode: string;
}

/** The one-text-field form the order stores (Order.shipAddress): one item per
 * line, in the order street, city, state/province (left out when empty),
 * postal code. Readable as-is in emails and the admin, and parsed back by
 * parseShipAddress. */
export function composeShipAddress(parts: ShipAddressParts): string {
  const clean = (s: string | undefined) => (s ?? "").replace(/\s*[\r\n]+\s*/g, ", ").trim();
  return [clean(parts.street), clean(parts.city), clean(parts.state), clean(parts.postcode)].filter(Boolean).join("\n");
}

export interface ParsedShipAddress {
  street1: string;
  city: string;
  state: string;
  postcode: string;
}

const looksLikePostcode = (s: string) => /\d/.test(s) && s.length <= 12;

/** Reads an Order.shipAddress back into fields. Understands the layout
 * composeShipAddress writes; older orders typed into one free-text box are
 * read on a best-effort basis (a final line or comma part that looks like a
 * postal code, the part before it as the city). Anything it cannot work out
 * is returned empty, and shippingProblems() then reports exactly what is
 * missing instead of sending Lulu a broken address. */
export function parseShipAddress(raw: string | null | undefined): ParsedShipAddress {
  const text = (raw ?? "").trim();
  const empty: ParsedShipAddress = { street1: text, city: "", state: "", postcode: "" };
  if (!text) return empty;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 3 && looksLikePostcode(lines[lines.length - 1])) {
    const postcode = lines[lines.length - 1];
    // With a state line there are 4+ lines: street…, city, state, postcode.
    // Without one: street…, city, postcode.
    const stateLike = lines.length >= 4 && lines[lines.length - 2].length <= 30 && !/\d/.test(lines[lines.length - 2]);
    if (stateLike) {
      return {
        street1: lines.slice(0, lines.length - 3).join(", "),
        city: lines[lines.length - 3],
        state: lines[lines.length - 2],
        postcode,
      };
    }
    return { street1: lines.slice(0, lines.length - 2).join(", "), city: lines[lines.length - 2], state: "", postcode };
  }

  // Legacy single free-text box: "12 Main St, Springfield, IL 62704".
  const parts = text.split(/[\n,]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const m = last.match(/^([A-Za-z .'-]+?)\s+([A-Za-z0-9][A-Za-z0-9 -]{2,10})$/);
    if (m && /\d/.test(m[2]) && parts.length >= 3) {
      return { street1: parts.slice(0, parts.length - 2).join(", "), city: parts[parts.length - 2], state: m[1].trim(), postcode: m[2].trim() };
    }
    if (looksLikePostcode(last)) {
      return { street1: parts.slice(0, parts.length - 2).join(", "), city: parts[parts.length - 2], state: "", postcode: last };
    }
  }
  return empty;
}

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const CA_PROVINCES: Record<string, string> = {
  alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB", "newfoundland and labrador": "NL",
  "nova scotia": "NS", "northwest territories": "NT", nunavut: "NU", ontario: "ON", "prince edward island": "PE",
  quebec: "QC", saskatchewan: "SK", yukon: "YT",
};
const AU_STATES: Record<string, string> = {
  "new south wales": "NSW", victoria: "VIC", queensland: "QLD", "western australia": "WA", "south australia": "SA",
  tasmania: "TAS", "australian capital territory": "ACT", "northern territory": "NT",
};
const STATE_TABLES: Record<string, Record<string, string>> = { US: US_STATES, CA: CA_PROVINCES, AU: AU_STATES };

/** Countries where Lulu requires a state_code. */
export const STATE_REQUIRED_COUNTRIES = ["US", "CA", "AU", "MX"];

/** "Illinois" / "IL" → "IL". Other countries pass a short code through and
 * otherwise send nothing (Lulu only requires a state for the countries
 * above). */
export function normaliseStateCode(countryIso: string, state: string): string {
  const s = state.trim();
  if (!s) return "";
  const table = STATE_TABLES[countryIso];
  if (table) {
    const byName = table[s.toLowerCase()];
    if (byName) return byName;
    const upper = s.toUpperCase();
    if (Object.values(table).includes(upper)) return upper;
    return "";
  }
  return /^[A-Za-z0-9]{1,3}$/.test(s) ? s.toUpperCase() : "";
}

/** Keeps "+" and digits only, at most Lulu's 20 characters. */
export function cleanPhone(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/[^\d+]/g, "");
  return s.slice(0, 20);
}

export interface LuluAddress {
  name: string;
  street1: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string;
  phone_number?: string;
  email: string;
}

export function buildLuluAddress(opts: {
  name: string;
  email: string;
  rawAddress: string | null | undefined;
  countryIso: string;
  phone?: string | null;
}): LuluAddress {
  const p = parseShipAddress(opts.rawAddress);
  const state = normaliseStateCode(opts.countryIso, p.state);
  const phone = cleanPhone(opts.phone);
  return {
    name: opts.name.trim(),
    street1: p.street1,
    city: p.city,
    ...(state ? { state_code: state } : {}),
    postcode: p.postcode,
    country_code: opts.countryIso,
    ...(phone ? { phone_number: phone } : {}),
    email: opts.email.trim(),
  };
}

/** Plain-English reasons Lulu would refuse this address. Empty = fine. */
export function shippingProblems(a: LuluAddress): string[] {
  const out: string[] = [];
  if (!a.name) out.push("recipient name is missing");
  if (!a.street1) out.push("street address is missing");
  if (!a.city) out.push("city is missing");
  if (!a.postcode) out.push("postal code is missing");
  if (!/^[A-Z]{2}$/.test(a.country_code)) out.push("country is missing or not recognised");
  if (STATE_REQUIRED_COUNTRIES.includes(a.country_code) && !a.state_code) out.push(`state/province is required for ${a.country_code}`);
  if (!a.email) out.push("email is missing");
  // A missing phone number is not blocked here: Lulu falls back to the phone
  // saved on the Lulu account itself, and checkout now asks for one on
  // print orders.
  return out;
}

// ---------------------------------------------------------------------------
// Print job body
// ---------------------------------------------------------------------------

export interface LuluJobLine {
  title: string;
  podPackageId: string;
  coverUrl: string;
  interiorUrl: string;
  quantity: number;
}

/** Plain-English reasons a line can't be sent. Empty = fine. */
export function lineProblems(line: LuluJobLine): string[] {
  const out: string[] = [];
  const pod = toLuluPodPackageId(line.podPackageId);
  if (!pod || pod.length > LULU_POD_PACKAGE_ID_MAX) out.push(`"${line.title}": invalid print package code`);
  if (!line.interiorUrl) out.push(`"${line.title}": no interior (manuscript) file on record`);
  if (!line.coverUrl) out.push(`"${line.title}": no cover file on record`);
  if (!Number.isInteger(line.quantity) || line.quantity < 1) out.push(`"${line.title}": invalid quantity`);
  return out;
}

export function buildLuluPrintJobBody(opts: {
  externalId: string;
  contactEmail: string;
  address: LuluAddress;
  lines: LuluJobLine[];
  shippingLevel?: "MAIL" | "GROUND" | "EXPEDITED" | "EXPRESS";
}) {
  return {
    contact_email: opts.contactEmail,
    external_id: opts.externalId,
    line_items: opts.lines.map((l, i) => {
      const pod = toLuluPodPackageId(l.podPackageId);
      return {
        external_id: `${opts.externalId}-${i + 1}`,
        title: l.title.slice(0, 255),
        quantity: l.quantity,
        pod_package_id: pod,
        printable_normalization: {
          pod_package_id: pod,
          cover: { source_url: l.coverUrl },
          interior: { source_url: l.interiorUrl },
        },
      };
    }),
    shipping_address: opts.address,
    shipping_level: opts.shippingLevel ?? "MAIL",
  };
}
