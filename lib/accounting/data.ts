import { prisma } from "@/lib/prisma";
import { payoutMethodLabel } from "@/lib/payout-method-label";
import { COMPANY_ACCOUNT_NUMBER, type ExpenseRow, type OrderRow, type SaleRow } from "@/lib/accounting/calc";
import { monthKeyOf, previousMonthKey } from "@/lib/accounting/period";
import type { EarningRow, PayoutRow } from "@/lib/accounting/payouts";
import { getTestArchive, type TestArchive, type TestAudit } from "@/lib/accounting/test-data";
import { summarizeTotals, type LuluOrderInput, type LuluTotals } from "@/lib/lulu-report";

/**
 * Reads everything the Accounting page needs from the database. Server only. Nothing here writes.
 *
 * Only PAID orders count: a sale line is created when checkout starts and is not real money until its order is PAID
 * (see lib/paid-sales.ts). The month an order counts in is the month it was placed, in Nairobi time.
 */

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

export interface LuluLedgerRow {
  orderId: string;
  /** Last 8 characters of the order id, as on the Lulu Publishing tab. */
  orderNumber: string;
  /** The reference the customer was given on their receipt (first 8 characters). */
  customerRef: string;
  createdAt: Date;
  books: string;
  formats: string;
  printingCost: number | null;
  shipping: number | null;
  fulfillment: number | null;
  luluOrderNumber: string;
  luluStatus: string;
  isTest: boolean;
  /** What the customer paid on this order for printing + shipping + fulfillment. */
  paidPassThrough: number;
  input: LuluOrderInput;
}

export interface AccountingSource {
  sales: SaleRow[];
  orders: OrderRow[];
  earnings: EarningRow[];
  payouts: PayoutRow[];
  lulu: LuluLedgerRow[];
  expenses: ExpenseRow[];
  companyBooksPublished: number;
  companyAccountFound: boolean;
  /** The archive marker when the admin has archived test figures, and the check of what the figures are made from. */
  archive: TestArchive | null;
  audit: TestAudit;
}

export async function loadAccountingSource(): Promise<AccountingSource> {
  const company = await prisma.user.findUnique({
    where: { accountNumber: COMPANY_ACCOUNT_NUMBER },
    select: { id: true, authorProfile: { select: { id: true } }, affiliateProfile: { select: { id: true } } },
  });

  const archive = await getTestArchive();
  const cutoff = archive ? new Date(archive.archivedAt) : null;
  const [lines, paidOrders, logs, payoutRows, expenseRows, booksCount] = await Promise.all([
    prisma.saleLine.findMany({
      where: { order: { status: "PAID" } },
      select: {
        id: true, orderId: true, format: true, grossAmount: true, companyShare: true, authorShare: true, affiliateShare: true,
        authorReferralShare: true, printingCost: true, createdAt: true,
        order: { select: { id: true, createdAt: true, isTestData: true } },
        book: { select: { title: true, author: { select: { userId: true, user: { select: { name: true, accountNumber: true } } } } } },
        affiliateLink: { select: { affiliate: { select: { userId: true, user: { select: { name: true, accountNumber: true } } } } } },
        authorReferralAffiliate: { select: { userId: true, user: { select: { name: true, accountNumber: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: { status: "PAID" },
      select: {
        id: true, createdAt: true, totalAmount: true, shippingAmount: true, fulfillmentAmount: true, isTestData: true,
        printJobId: true, printJobStatus: true, luluStatus: true, luluShippedAt: true, luluShippingCost: true, luluFulfillmentCost: true,
        luluActualProduction: true, luluActualShipping: true, luluActualFulfillment: true,
        lines: { select: { format: true, grossAmount: true, printingCost: true, book: { select: { title: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.paymentLog.findMany({ where: { order: { status: "PAID" } }, select: { orderId: true, rawPayload: true } }),
    prisma.payoutRequest.findMany({
      select: {
        id: true, userId: true, amount: true, status: true, earningsType: true, requestedAt: true, resolvedAt: true,
        user: { select: { name: true, accountNumber: true } },
        recipient: { select: { type: true } },
      },
      orderBy: { requestedAt: "asc" },
    }),
    prisma.accountingExpense.findMany({ orderBy: [{ expenseDate: "asc" }, { enteredAt: "asc" }] }),
    company?.authorProfile ? prisma.book.count({ where: { authorId: company.authorProfile.id, status: "PUBLISHED" } }) : Promise.resolve(0),
  ]);

  // An order made with sandbox money: flagged as test data, or paid through a gateway in test mode.
  const sandboxOrders = new Set<string>();
  for (const l of logs) {
    const payload = l.rawPayload as { siteGatewayMode?: unknown } | null;
    if (payload && typeof payload === "object" && payload.siteGatewayMode === "test") sandboxOrders.add(l.orderId);
  }
  const isTest = (orderId: string, flagged: boolean) => flagged || sandboxOrders.has(orderId);
  // Archived test orders (test money, placed before the archive moment) are left out of every Accounting figure.
  const archivedOrderIds = new Set<string>();
  if (cutoff) for (const o of paidOrders) if (isTest(o.id, o.isTestData) && o.createdAt <= cutoff) archivedOrderIds.add(o.id);

  const sales: SaleRow[] = [];
  const earnings: EarningRow[] = [];
  for (const l of lines) {
    if (archivedOrderIds.has(l.orderId)) continue;
    const orderRef = l.orderId.slice(0, 8).toUpperCase();
    const authorUser = l.book.author.user;
    const promoter = l.affiliateLink?.affiliate ?? null;
    const referrer = l.authorReferralAffiliate ?? null;
    const row: SaleRow = {
      lineId: l.id,
      orderId: l.orderId,
      orderRef,
      createdAt: l.order.createdAt,
      bookTitle: l.book.title,
      format: l.format ?? "ebook",
      gross: num(l.grossAmount),
      companyShare: num(l.companyShare),
      authorShare: num(l.authorShare),
      affiliateShare: num(l.affiliateShare),
      referralShare: num(l.authorReferralShare),
      printingCost: num(l.printingCost),
      companyIsAuthor: authorUser.accountNumber === COMPANY_ACCOUNT_NUMBER,
      companyIsReferrer: referrer?.user.accountNumber === COMPANY_ACCOUNT_NUMBER,
      companyIsPromoter: promoter?.user.accountNumber === COMPANY_ACCOUNT_NUMBER,
      isTest: isTest(l.orderId, l.order.isTestData),
    };
    sales.push(row);
    const when = l.order.createdAt;
    if (row.authorShare > 0) earnings.push({ userId: l.book.author.userId, userName: authorUser.name, accountNumber: authorUser.accountNumber, kind: "AUTHOR", type: "ROYALTY", createdAt: when, amount: row.authorShare, orderRef, bookTitle: row.bookTitle });
    if (row.affiliateShare > 0 && promoter) earnings.push({ userId: promoter.userId, userName: promoter.user.name, accountNumber: promoter.user.accountNumber, kind: "AFFILIATE", type: "PROMOTION", createdAt: when, amount: row.affiliateShare, orderRef, bookTitle: row.bookTitle });
    if (row.referralShare > 0 && referrer) earnings.push({ userId: referrer.userId, userName: referrer.user.name, accountNumber: referrer.user.accountNumber, kind: "AFFILIATE", type: "REFERRAL", createdAt: when, amount: row.referralShare, orderRef, bookTitle: row.bookTitle });
  }

  const orders: OrderRow[] = [];
  const lulu: LuluLedgerRow[] = [];
  for (const o of paidOrders) {
    if (archivedOrderIds.has(o.id)) continue;
    const orderRef = o.id.slice(0, 8).toUpperCase();
    const test = isTest(o.id, o.isTestData);
    orders.push({ orderId: o.id, orderRef, createdAt: o.createdAt, totalAmount: num(o.totalAmount), shipping: num(o.shippingAmount), fulfillment: num(o.fulfillmentAmount), isTest: test });
    const printLines = o.lines.filter((x) => x.format === "paperback" || x.format === "hardcover");
    if (printLines.length === 0) continue;
    const lineInputs = printLines.map((x) => ({ paidBooks: num(x.grossAmount), printingCost: numOrNull(x.printingCost) }));
    const saved = lineInputs.reduce((s, x) => s + (x.printingCost ?? 0), 0);
    const production = numOrNull(o.luluActualProduction) ?? (lineInputs.some((x) => x.printingCost != null) ? saved : null);
    const shipping = numOrNull(o.luluActualShipping) ?? numOrNull(o.luluShippingCost);
    const fulfillment = numOrNull(o.luluActualFulfillment) ?? numOrNull(o.luluFulfillmentCost);
    const input: LuluOrderInput = {
      orderId: o.id, createdAt: o.createdAt, printJobStatus: o.printJobStatus, luluStatus: o.luluStatus, luluShippedAt: o.luluShippedAt,
      shippingPaid: num(o.shippingAmount), fulfillmentPaid: num(o.fulfillmentAmount), luluProduction: production, luluShipping: shipping, luluFulfillment: fulfillment, lines: lineInputs,
    };
    lulu.push({
      orderId: o.id,
      orderNumber: o.id.slice(-8).toUpperCase(),
      customerRef: orderRef,
      createdAt: o.createdAt,
      books: printLines.map((x) => x.book.title).join(", "),
      formats: [...new Set(printLines.map((x) => (x.format === "hardcover" ? "Hardcover" : "Paperback")))].join(", "),
      printingCost: production,
      shipping,
      fulfillment,
      luluOrderNumber: o.printJobId ?? "—",
      luluStatus: o.luluStatus ?? (o.printJobStatus === "SUBMITTED" ? "Sent (not yet checked)" : o.printJobStatus === "FAILED" ? "Failed" : "Not sent"),
      isTest: test,
      paidPassThrough: lineInputs.reduce((s, x) => s + (x.printingCost ?? 0), 0) + num(o.shippingAmount) + num(o.fulfillmentAmount),
      input,
    });
  }

  const companyUserId = company?.id ?? null;
  const payouts: PayoutRow[] = payoutRows.map((p) => ({
    id: p.id,
    reference: `PAYOUT-${p.id.slice(-8).toUpperCase()}`,
    userId: p.userId,
    recipientName: p.user.name,
    accountNumber: p.user.accountNumber,
    kind: p.earningsType === "AFFILIATE" ? "AFFILIATE" : "AUTHOR",
    amount: num(p.amount),
    status: p.status,
    method: payoutMethodLabel(p.recipient.type),
    requestedAt: p.requestedAt,
    resolvedAt: p.resolvedAt,
    // Payouts for a month's earnings are queued in the month after it.
    coversMonth: previousMonthKey(monthKeyOf(p.requestedAt)),
  }));

  const expenseRowsShown = archive?.includeExpenses && cutoff ? expenseRows.filter((e) => e.enteredAt > cutoff) : expenseRows;
  const expenses: ExpenseRow[] = expenseRowsShown.map((e) => ({
    id: e.id,
    date: e.expenseDate.toISOString().slice(0, 10),
    monthKey: e.monthKey,
    category: e.category,
    description: e.description,
    amount: num(e.amount),
    receiptFileId: e.receiptFileId,
    receiptName: e.receiptName,
    enteredByName: e.enteredByName,
    enteredAt: e.enteredAt.toISOString(),
    updatedByName: e.updatedByName,
    updatedAt: e.updatedAt ? e.updatedAt.toISOString() : null,
  }));

  const everyTest = paidOrders.filter((o) => isTest(o.id, o.isTestData));
  const live = paidOrders.filter((o) => !isTest(o.id, o.isTestData)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const closedWithTest: string[] = [];
  const audit: TestAudit = {
    paidOrders: paidOrders.length,
    testOrders: everyTest.length,
    flaggedOnOrder: everyTest.filter((o) => o.isTestData).length,
    testByGatewayOnly: everyTest.filter((o) => !o.isTestData).length,
    liveOrders: live.slice(0, 25).map((o) => ({ ref: o.id.slice(0, 8).toUpperCase(), date: o.createdAt.toISOString(), total: num(o.totalAmount) })),
    liveOrderCount: live.length,
    archivedTestOrders: archivedOrderIds.size,
    expenses: expenseRows.length,
    payoutRequests: payoutRows.length,
    closedMonthsWithTest: closedWithTest,
    allTest: live.length === 0,
  };

  return {
    sales,
    orders,
    archive,
    audit,
    // The company's own account is the company itself, so it is never "owed" a payout.
    earnings: earnings.filter((e) => e.userId !== companyUserId),
    payouts: payouts.filter((p) => p.userId !== companyUserId),
    lulu,
    expenses,
    companyBooksPublished: booksCount,
    companyAccountFound: company !== null,
  };
}

export function luluTotalsFor(rows: LuluLedgerRow[]): LuluTotals {
  return summarizeTotals(rows.map((r) => r.input));
}
