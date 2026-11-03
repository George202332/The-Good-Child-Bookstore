import { prisma } from "@/lib/prisma";
import { getPaymentModes } from "@/lib/api-keys";

/**
 * Test (sandbox) data in the Accounting tab. Server only.
 *
 *  - The "Test Data" label is decided by the payment mode setting: while Paystack or PayPal is in test mode, the tab is test data.
 *  - Test and live orders stay separate: each order is flagged (Order.isTestData, or paid through a gateway in test mode).
 *  - "Archiving" test figures never deletes anything. It stores one marker (Setting "accounting_test_archive") and every test order
 *    placed up to that moment (and, if chosen, every expense entered up to it) is left out of the Accounting figures. Restoring
 *    removes the marker. Orders, payments and receipts elsewhere on the site are untouched.
 */

export const ARCHIVE_KEY = "accounting_test_archive";
export const ARCHIVE_PHRASE = "ARCHIVE TEST DATA";

export interface TestArchive {
  archivedAt: string;
  byName: string;
  orders: number;
  expenses: number;
  includeExpenses: boolean;
}

export async function isPaymentTestMode(): Promise<{ test: boolean; paystack: "test" | "live"; paypal: "test" | "live" }> {
  try {
    const m = await getPaymentModes();
    const paystack = m.paystack.mode === "live" ? "live" : "test";
    const paypal = m.paypal.mode === "live" ? "live" : "test";
    return { test: paystack === "test" || paypal === "test", paystack, paypal };
  } catch {
    // If the mode cannot be read, say "test": a wrong Test Data label is far safer than a missing one.
    return { test: true, paystack: "test", paypal: "test" };
  }
}

export async function getTestArchive(): Promise<TestArchive | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: ARCHIVE_KEY } });
    const v = row?.value as Partial<TestArchive> | null;
    if (!v || typeof v.archivedAt !== "string" || Number.isNaN(Date.parse(v.archivedAt))) return null;
    return { archivedAt: v.archivedAt, byName: String(v.byName ?? ""), orders: Number(v.orders ?? 0), expenses: Number(v.expenses ?? 0), includeExpenses: !!v.includeExpenses };
  } catch {
    return null;
  }
}

export async function saveTestArchive(a: TestArchive): Promise<void> {
  const value = JSON.parse(JSON.stringify(a));
  await prisma.setting.upsert({ where: { key: ARCHIVE_KEY }, update: { value }, create: { key: ARCHIVE_KEY, value } });
}

export async function clearTestArchive(): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: ARCHIVE_KEY } });
}

/** What the figures are made from, so it can be checked that "all current data is test data". */
export interface TestAudit {
  paidOrders: number;
  testOrders: number;
  /** Of the test orders: flagged on the order itself / only known from a payment made in test mode. */
  flaggedOnOrder: number;
  testByGatewayOnly: number;
  /** Paid orders that are NOT test data (real money), newest first, up to 25. */
  liveOrders: { ref: string; date: string; total: number }[];
  liveOrderCount: number;
  archivedTestOrders: number;
  expenses: number;
  payoutRequests: number;
  closedMonthsWithTest: string[];
  allTest: boolean;
}
