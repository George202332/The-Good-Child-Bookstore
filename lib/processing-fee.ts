/**
 * THE PROCESSING FEE. One calculation, used by checkout (what the customer sees), the order and the request sent to the payment
 * gateway (what is charged), the receipt and the accounting. Pure code: no database, no network.
 *
 * Why it exists: the payment gateway keeps a cut of everything it takes. On PRINT orders the company wants to receive the full
 * amount due, so the customer is charged a Processing Fee that covers that cut. It is never charged on eBooks or Audiobooks, and
 * in a basket with both it is worked out on the print part only.
 *
 * The formula (amounts in dollars, worked in whole cents):
 *
 *   amount due   = the printed books + postage + Lulu's fulfillment fee on the order
 *   charged      = (amount due + gateway fixed fee) / (1 - gateway rate)      rounded UP to the next cent
 *   Processing Fee = charged - amount due
 *
 * After the gateway takes (charged x rate + fixed fee), what is left is the amount due, to within one cent (rounding up always
 * favours the company by less than a cent, never the customer).
 */

export type FeeRoute = "paystack" | "mpesa" | "paypal";

export interface GatewayRate {
  /** The gateway's percentage, as a fraction: 0.03 means 3%. */
  rate: number;
  /** The gateway's fixed fee per payment, in dollars. */
  fixed: number;
}

export type FeeRates = Record<FeeRoute, GatewayRate>;

/**
 * Starting rates, used until an admin saves their own (Admin > Processing Fee Rates). They are PLACEHOLDERS to be checked against
 * what each gateway really charges on this account: Paystack publishes its rates at https://paystack.com/pricing (they depend on
 * the country of the Paystack account and the payment channel) and PayPal at https://www.paypal.com/webapps/mpp/merchant-fees
 * (PayPal's rate is higher for international buyers and when currency is converted). The Site Health page compares the fee charged
 * with what the gateway really kept, so a wrong rate shows up there.
 */
export const DEFAULT_FEE_RATES: FeeRates = {
  paystack: { rate: 0.03, fixed: 0 },
  mpesa: { rate: 0.03, fixed: 0 },
  paypal: { rate: 0.0349, fixed: 0.49 },
};

export const ROUTE_LABEL: Record<FeeRoute, string> = { paystack: "Card (Paystack)", mpesa: "M-Pesa (Paystack)", paypal: "PayPal" };

/** If the fee charged differs from what the gateway really kept by more than this many dollars on an order, Site Health warns. */
export const FEE_MISMATCH_THRESHOLD_USD = 0.5;

const toCents = (n: number) => Math.round((n + Number.EPSILON) * 100);

export function isValidRate(r: unknown): r is GatewayRate {
  const g = r as GatewayRate;
  return !!g && typeof g.rate === "number" && typeof g.fixed === "number" && g.rate >= 0 && g.rate < 0.5 && g.fixed >= 0 && g.fixed <= 5;
}

/** Reads the saved rates, falling back to the defaults for anything missing or invalid. */
export function normalizeRates(saved: unknown): FeeRates {
  const out: FeeRates = { ...DEFAULT_FEE_RATES };
  if (saved && typeof saved === "object") {
    for (const route of Object.keys(DEFAULT_FEE_RATES) as FeeRoute[]) {
      const r = (saved as Record<string, unknown>)[route];
      if (isValidRate(r)) out[route] = { rate: r.rate, fixed: r.fixed };
    }
  }
  return out;
}

export interface FeeResult {
  /** The Processing Fee, in dollars (0 when nothing printed is being bought). */
  fee: number;
  /** The amount due on the print part plus the fee. */
  chargedOnPrint: number;
  /** What the gateway is expected to keep of that charged amount, per the rates in use. */
  expectedGatewayCut: number;
  rate: number;
  fixed: number;
  amountDue: number;
}

/** The Processing Fee for a print amount due, rounded up to the cent. A zero amount due has no fee. */
export function computeProcessingFee(amountDue: number, gw: GatewayRate): FeeResult {
  const dueC = toCents(amountDue);
  if (!(dueC > 0)) return { fee: 0, chargedOnPrint: 0, expectedGatewayCut: 0, rate: gw.rate, fixed: gw.fixed, amountDue: 0 };
  const chargedExact = (dueC / 100 + gw.fixed) / (1 - gw.rate);
  // Up to the next whole cent; a tiny epsilon stops a value that is exactly on a cent from being pushed up by float noise.
  const chargedC = Math.ceil(chargedExact * 100 - 1e-7);
  const feeC = Math.max(0, chargedC - dueC);
  const charged = chargedC / 100;
  return {
    fee: feeC / 100,
    chargedOnPrint: charged,
    expectedGatewayCut: toCents(charged * gw.rate + gw.fixed) / 100,
    rate: gw.rate,
    fixed: gw.fixed,
    amountDue: dueC / 100,
  };
}

/** The amount due the fee is worked out on: printed books + postage + Lulu's fulfillment fee. Zero when nothing printed is bought. */
export function printAmountDue(parts: { printLinesTotal: number; shipping: number; fulfillment: number }): number {
  if (!(parts.printLinesTotal > 0)) return 0;
  return (toCents(parts.printLinesTotal) + toCents(parts.shipping) + toCents(parts.fulfillment)) / 100;
}

/** What the gateway is expected to keep of a whole payment (used when the gateway does not report its own fee). */
export function estimateGatewayCost(totalCharged: number, gw: GatewayRate): number {
  return toCents(totalCharged * gw.rate + gw.fixed) / 100;
}

/** The record saved on the order so the fee can always be explained exactly as charged. */
export interface FeeBasis {
  route: FeeRoute;
  rate: number;
  fixed: number;
  amountDue: number;
  chargedOnPrint: number;
  expectedGatewayCut: number;
}

export function feeBasis(route: FeeRoute, r: FeeResult): FeeBasis {
  return { route, rate: r.rate, fixed: r.fixed, amountDue: r.amountDue, chargedOnPrint: r.chargedOnPrint, expectedGatewayCut: r.expectedGatewayCut };
}

/** How much of a refund returns the Processing Fee: the fee's share of the order, in proportion to how much of the order is refunded. */
export function refundedFeeShare(orderTotal: number, orderFee: number, refundAmount: number): number {
  if (!(orderFee > 0) || !(orderTotal > 0) || !(refundAmount > 0)) return 0;
  const share = Math.min(1, refundAmount / orderTotal);
  return Math.min(orderFee, Math.round(orderFee * share * 100) / 100);
}

/** The gateway's own report of what it kept, read from the confirmation payload when it carries one. Null when it does not. */
export function gatewayFeeFromPayload(gateway: "PAYSTACK" | "PAYPAL", payload: unknown): number | null {
  try {
    const p = payload as Record<string, unknown> | null;
    if (!p) return null;
    if (gateway === "PAYPAL") {
      const unit = (p.captured as { purchase_units?: { payments?: { captures?: { seller_receivable_breakdown?: { paypal_fee?: { currency_code?: string; value?: string } } }[] } }[] } | undefined)?.purchase_units?.[0];
      const fee = unit?.payments?.captures?.[0]?.seller_receivable_breakdown?.paypal_fee;
      if (fee?.value && (!fee.currency_code || fee.currency_code === "USD")) {
        const n = Number(fee.value);
        return Number.isFinite(n) && n >= 0 ? n : null;
      }
      return null;
    }
    const data = p.data as { fees?: unknown; currency?: unknown } | undefined;
    if (data && typeof data.fees === "number" && (!data.currency || data.currency === "USD")) return data.fees / 100;
    return null;
  } catch {
    return null;
  }
}
