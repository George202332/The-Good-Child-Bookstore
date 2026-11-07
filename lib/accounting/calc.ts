/**
 * THE ACCOUNTING FORMULAS. Pure code: no database, no network, so every rule can be tested.
 *
 * All sums are worked out in whole cents (integers) so nothing drifts, then shown in dollars.
 *
 * IN PLAIN WORDS (this same text is shown on the Accounting page; see FORMULA_STEPS):
 *
 *  1. Company sales revenue  = the company's 30% share of eBook, Audiobook and Print sales
 *                              (for print: 30% of what is left after Lulu's printing cost, exactly as each sale
 *                              was stored at checkout), MINUS the referral commissions paid out of that share.
 *                              Each stored sale line's "company share" is ALREADY after the referral commission,
 *                              so step 1 is the sum of those; the page also shows the 30% before and the
 *                              commission taken off, which add back up to it.
 *  2. Company author account  = account 30000064: its royalties + referral earnings + promotion earnings, in GROSS.
 *  3. Total revenue           = step 1 + step 2, before any tax.
 *  4. Royalty to George Otieno= 10% of total revenue (before tax). A company cost.
 *  5. Other company expenses  = the expenses an admin entered + the 10% royalty (one total, royalty counted ONCE).
 *  6. Profit                  = total revenue - the 10% royalty - the entered expenses - the 5% tax on the author account.
 *  7. Income tax              = 30% of PROFIT (never of revenue). A loss month has no income tax (0).
 *                              Retained = profit - income tax.
 *  8. Tax on the author account = 5% of that account's gross earnings (royalties + referral + promotion).
 *                              It is a cost taken BEFORE profit, so the 30% income tax is worked out on a profit that is
 *                              already lower by it. Shown as its own line.
 *  9. Every figure is worked out for each month; the LIFETIME figure is the sum of the months (so a month and the
 *     lifetime always agree, to the cent).
 *
 * 10. Processing Fee (print orders only): the customer pays a fee that covers the payment gateway's cut. Two lines are shown side by
 *     side: "Processing Fees Collected" (revenue; refunded fees taken off) and "Payment Gateway Costs" (expense; what the gateway
 *     really kept on those orders). ONLY THE NET DIFFERENCE (collected - costs) is added to total revenue, so only the net moves
 *     the 10% royalty, the profit and the 30% income tax. It is never in author royalties, affiliate earnings or balances.
 *
 * Lulu's printing cost, shipping and fulfillment fee are PASS-THROUGH: never company revenue or cost.
 */

export const ROYALTY_RATE = 0.10;
export const INCOME_TAX_RATE = 0.30;
export const AUTHOR_ACCOUNT_TAX_RATE = 0.05;
/** The company's own author account ("The Good Child Bookstore"). */
export const COMPANY_ACCOUNT_NUMBER = "30000064";

/** One sold line, as stored at checkout. Amounts are dollars with at most two decimals. */
export interface SaleRow {
  lineId: string;
  orderId: string;
  /** Short order reference shown to people, e.g. the last 8 characters of the order id, upper-cased. */
  orderRef: string;
  /** When the order was placed (decides the month, Nairobi time). */
  createdAt: Date;
  bookTitle: string;
  format: string;
  gross: number;
  companyShare: number;
  authorShare: number;
  affiliateShare: number;
  referralShare: number;
  printingCost: number;
  companyIsAuthor: boolean;
  companyIsReferrer: boolean;
  companyIsPromoter: boolean;
  /** Sandbox / test money. */
  isTest: boolean;
}

/** One paid order (for the amounts that are not tied to a single book line). */
export interface OrderRow {
  orderId: string;
  orderRef: string;
  createdAt: Date;
  /** What the customer paid in total. */
  totalAmount: number;
  shipping: number;
  fulfillment: number;
  /** The Processing Fee the customer paid on this order (0 when none). */
  processingFee?: number;
  /** The part of that fee returned to the customer through refunds. */
  processingFeeRefunded?: number;
  /** What the payment gateway really kept on this order (0 when the order had no Processing Fee). */
  gatewayCost?: number;
  isTest: boolean;
}

export interface ExpenseRow {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  monthKey: string;
  category: string;
  description: string;
  amount: number;
  /** Who entered it and when (ISO), whether it has a receipt, and the last edit. Not used in any calculation. */
  receiptFileId?: string | null;
  receiptName?: string | null;
  enteredByName?: string;
  enteredAt?: string;
  updatedByName?: string | null;
  updatedAt?: string | null;
}

export const cents = (n: number): number => Math.round((n + Number.EPSILON) * 100);
export const dollars = (c: number): number => c / 100;

/** The things a total on the page can be clicked to explain. */
export type Metric =
  | "customersPaid"
  | "companyGrossShare"
  | "referralCommissions"
  | "salesRevenue"
  | "acctRoyalties"
  | "acctReferral"
  | "acctPromotion"
  | "acctGross"
  | "totalRevenue"
  | "georgeRoyalty"
  | "enteredExpenses"
  | "authorTax"
  | "profit"
  | "incomeTax"
  | "retained"
  | "authorRoyalties"
  | "referralEarnings"
  | "promotionCommissions"
  | "luluPrinting"
  | "luluShipping"
  | "luluFulfillment"
  | "processingFeesCollected"
  | "gatewayCosts"
  | "processingNet";

/** The amount (in cents) one sale line contributes to a sale-based metric; 0 when it does not. */
export function lineContribution(row: SaleRow, metric: Metric): number {
  switch (metric) {
    case "companyGrossShare": return cents(row.companyShare) + cents(row.referralShare);
    case "referralCommissions": return cents(row.referralShare);
    case "salesRevenue": return cents(row.companyShare);
    case "acctRoyalties": return row.companyIsAuthor ? cents(row.authorShare) : 0;
    case "acctReferral": return row.companyIsReferrer ? cents(row.referralShare) : 0;
    case "acctPromotion": return row.companyIsPromoter ? cents(row.affiliateShare) : 0;
    case "acctGross":
      return lineContribution(row, "acctRoyalties") + lineContribution(row, "acctReferral") + lineContribution(row, "acctPromotion");
    case "authorRoyalties": return cents(row.authorShare);
    case "referralEarnings": return cents(row.referralShare);
    case "promotionCommissions": return cents(row.affiliateShare);
    case "luluPrinting": return cents(row.printingCost);
    default: return 0;
  }
}

export function orderContribution(row: OrderRow, metric: Metric): number {
  switch (metric) {
    case "customersPaid": return cents(row.totalAmount);
    case "luluShipping": return cents(row.shipping);
    case "luluFulfillment": return cents(row.fulfillment);
    case "processingFeesCollected": return cents(row.processingFee ?? 0) - cents(row.processingFeeRefunded ?? 0);
    case "gatewayCosts": return cents(row.gatewayCost ?? 0);
    case "processingNet": return orderContribution(row, "processingFeesCollected") - cents(row.gatewayCost ?? 0);
    default: return 0;
  }
}

/** All the figures for one month, in CENTS. */
export interface MonthCents {
  monthKey: string;
  orders: number;
  saleLines: number;
  // Money received
  customersPaid: number;
  companyNet: number; // company share after referral commissions
  authorRoyalties: number; // all authors, including the company account
  referralEarnings: number; // all affiliates, including the company account
  promotionCommissions: number; // all affiliates, including the company account
  luluPrinting: number;
  luluShipping: number;
  luluFulfillment: number;
  passThrough: number;
  /** The Processing Fee customers were charged (before refunds); it is part of what customers paid, so the books tie with it. */
  processingFeeCharged: number;
  processingFeeRefunded: number;
  /** Revenue line: fees charged minus fees refunded. */
  processingFeesCollected: number;
  /** Expense line: what the gateway really kept on Processing Fee orders. */
  gatewayCosts: number;
  /** Collected minus costs. The only part that reaches total revenue, royalty, profit and income tax. */
  processingNet: number;
  /** Customers paid minus everything accounted for above. Zero means the books tie exactly. */
  unreconciled: number;
  // Step 1
  companyGrossShare: number;
  referralCommissions: number;
  salesRevenue: number;
  // Step 2
  acctRoyalties: number;
  acctReferral: number;
  acctPromotion: number;
  acctGross: number;
  // Steps 3-8
  totalRevenue: number;
  georgeRoyalty: number;
  enteredExpenses: number;
  otherExpenses: number; // entered + royalty
  authorTax: number;
  profit: number;
  incomeTax: number;
  retained: number;
}

export function emptyMonth(monthKey: string): MonthCents {
  return {
    monthKey, orders: 0, saleLines: 0, customersPaid: 0, companyNet: 0, authorRoyalties: 0, referralEarnings: 0, promotionCommissions: 0,
    luluPrinting: 0, luluShipping: 0, luluFulfillment: 0, passThrough: 0, processingFeeCharged: 0, processingFeeRefunded: 0, processingFeesCollected: 0, gatewayCosts: 0, processingNet: 0, unreconciled: 0, companyGrossShare: 0, referralCommissions: 0,
    salesRevenue: 0, acctRoyalties: 0, acctReferral: 0, acctPromotion: 0, acctGross: 0, totalRevenue: 0, georgeRoyalty: 0,
    enteredExpenses: 0, otherExpenses: 0, authorTax: 0, profit: 0, incomeTax: 0, retained: 0,
  };
}

/** Works out one month from the sale lines, orders and expenses that fall in it (already filtered to that month). */
export function computeMonth(monthKey: string, sales: SaleRow[], orders: OrderRow[], expenses: ExpenseRow[]): MonthCents {
  const m = emptyMonth(monthKey);
  m.orders = orders.length;
  m.saleLines = sales.length;
  for (const s of sales) {
    m.companyNet += cents(s.companyShare);
    m.authorRoyalties += cents(s.authorShare);
    m.referralEarnings += cents(s.referralShare);
    m.promotionCommissions += cents(s.affiliateShare);
    m.luluPrinting += cents(s.printingCost);
    m.companyGrossShare += lineContribution(s, "companyGrossShare");
    m.referralCommissions += cents(s.referralShare);
    m.acctRoyalties += lineContribution(s, "acctRoyalties");
    m.acctReferral += lineContribution(s, "acctReferral");
    m.acctPromotion += lineContribution(s, "acctPromotion");
  }
  for (const o of orders) {
    m.customersPaid += cents(o.totalAmount);
    m.luluShipping += cents(o.shipping);
    m.luluFulfillment += cents(o.fulfillment);
    m.processingFeeCharged += cents(o.processingFee ?? 0);
    m.processingFeeRefunded += cents(o.processingFeeRefunded ?? 0);
    m.gatewayCosts += cents(o.gatewayCost ?? 0);
  }
  m.processingFeesCollected = m.processingFeeCharged - m.processingFeeRefunded;
  m.processingNet = m.processingFeesCollected - m.gatewayCosts;
  m.salesRevenue = m.companyGrossShare - m.referralCommissions;
  m.acctGross = m.acctRoyalties + m.acctReferral + m.acctPromotion;
  m.totalRevenue = m.salesRevenue + m.acctGross + m.processingNet;
  m.georgeRoyalty = Math.round(m.totalRevenue * ROYALTY_RATE);
  m.enteredExpenses = expenses.reduce((s, e) => s + cents(e.amount), 0);
  m.otherExpenses = m.enteredExpenses + m.georgeRoyalty;
  m.authorTax = Math.round(m.acctGross * AUTHOR_ACCOUNT_TAX_RATE);
  m.profit = m.totalRevenue - m.georgeRoyalty - m.enteredExpenses - m.authorTax;
  m.incomeTax = m.profit > 0 ? Math.round(m.profit * INCOME_TAX_RATE) : 0;
  m.retained = m.profit - m.incomeTax;
  m.passThrough = m.luluPrinting + m.luluShipping + m.luluFulfillment;
  m.unreconciled = m.customersPaid - (m.companyNet + m.authorRoyalties + m.referralEarnings + m.promotionCommissions + m.passThrough + m.processingFeeCharged);
  return m;
}

/** Lifetime = the sum of the months, field by field, so a month and the lifetime can never disagree. */
export function sumMonths(months: MonthCents[], monthKey = "lifetime"): MonthCents {
  const t = emptyMonth(monthKey);
  const keys = Object.keys(t).filter((k) => k !== "monthKey") as (keyof MonthCents)[];
  for (const m of months) for (const k of keys) (t[k] as number) += (m[k] as number) || 0;
  return t;
}

export function toDollars(m: MonthCents): Record<string, number | string> {
  const out: Record<string, number | string> = { monthKey: m.monthKey };
  for (const [k, v] of Object.entries(m)) if (k !== "monthKey") out[k] = typeof v === "number" ? dollars(v) : v;
  return out;
}

export interface FormulaStep {
  n: number;
  title: string;
  words: string;
}

/** The calculation in plain words, in the order it is applied. Shown on the page and in the PDF. */
export const FORMULA_STEPS: FormulaStep[] = [
  { n: 1, title: "Company sales revenue", words: "The company's 30% share of eBook, Audiobook and Print sales (for print, 30% of what is left after Lulu's printing cost), minus the referral commissions paid out of that share." },
  { n: 2, title: "Company author account (30000064)", words: "Its book royalties, referral earnings and promotion earnings, counted in gross, as a separate line." },
  { n: 3, title: "Total revenue", words: "Step 1 plus step 2 plus the net Processing Fee result (fees collected minus payment gateway costs), before any tax." },
  { n: 4, title: "Royalty to George Otieno", words: "10% of total revenue, worked out before tax. This is the intellectual-property royalty for the website and is a company cost." },
  { n: 5, title: "Other company expenses", words: "The expenses entered by the admin plus the 10% royalty, as one total. The royalty is counted once." },
  { n: 6, title: "Tax on the author account", words: "5% of the company author account's earnings (royalties, referral and promotion). It is taken as a cost before profit, so it lowers profit and therefore the income tax." },
  { n: 7, title: "Profit", words: "Total revenue, minus the 10% royalty, minus the entered expenses, minus the 5% author-account tax." },
  { n: 8, title: "Income tax and retained", words: "Income tax is 30% of profit (never of revenue). A month with a loss has no income tax. Retained is profit after income tax." },
  { n: 9, title: "Processing Fee", words: "Printed books only. 'Processing Fees Collected' (what customers paid, less any refunded) and 'Payment Gateway Costs' (what Paystack or PayPal really kept) are shown side by side. Only the difference between them is added to total revenue, so only that difference affects the 10% royalty, profit and income tax. It is never part of author royalties, affiliate earnings or balances." },
  { n: 10, title: "Month and lifetime", words: "Everything is worked out month by month. Lifetime is the sum of the months. Lulu printing, shipping and fulfillment fee are pass-through money and are never company revenue or cost." },
];
