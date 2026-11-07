import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  computeMonth, sumMonths, lineContribution, cents, ROYALTY_RATE, INCOME_TAX_RATE, AUTHOR_ACCOUNT_TAX_RATE, FORMULA_STEPS,
  type SaleRow, type OrderRow, type ExpenseRow,
} from "../lib/accounting/calc";
import { monthKeyOf, monthBounds, isLastDayOfMonth, monthRange, nextMonthKey, previousMonthKey, isDateString, isMonthKey } from "../lib/accounting/period";
import { parseAmountToCents, validateExpense, receiptProblem, sniffReceiptType } from "../lib/accounting/expense-input";
import { computeOwed, totalOwed, type EarningRow, type PayoutRow } from "../lib/accounting/payouts";
import { toCsv, type ExportTable } from "../lib/accounting/exports";
import { barChartScene, pieChartScene, niceAxis, shade } from "../lib/accounting/charts";
import { scalePath } from "../lib/accounting/pdf-draw";
import { buildMonthlyReportPdf } from "../lib/accounting/report-pdf";
import { canViewFinancials, PERMISSIONS } from "../lib/roles";

const D = new Date("2026-10-10T09:00:00Z");

function sale(o: Partial<SaleRow> = {}): SaleRow {
  return {
    lineId: "l", orderId: "o", orderRef: "AAAAAAAA", createdAt: D, bookTitle: "B", format: "ebook", gross: 10, companyShare: 3, authorShare: 7, affiliateShare: 0,
    referralShare: 0, printingCost: 0, companyIsAuthor: false, companyIsReferrer: false, companyIsPromoter: false, isTest: false, ...o,
  };
}
const order = (o: Partial<OrderRow> = {}): OrderRow => ({ orderId: "o", orderRef: "AAAAAAAA", createdAt: D, totalAmount: 10, shipping: 0, fulfillment: 0, isTest: false, ...o });
const expense = (amount: number): ExpenseRow => ({ id: "e", date: "2026-10-05", monthKey: "2026-10", category: "Hosting", description: "x", amount });

describe("the calculation (steps 1 to 8)", () => {
  test("rates are exactly the ones in the brief", () => {
    assert.equal(ROYALTY_RATE, 0.1);
    assert.equal(INCOME_TAX_RATE, 0.3);
    assert.equal(AUTHOR_ACCOUNT_TAX_RATE, 0.05);
  });

  test("worked example from start to finish", () => {
    // Two ordinary eBook sales (company 30%) and one sale of the company's own book ($100: company 30 + author account 70).
    const sales = [sale({ gross: 100, companyShare: 30, authorShare: 70, companyIsAuthor: true }), sale({ lineId: "m", gross: 100, companyShare: 30, authorShare: 70 })];
    const orders = [order({ totalAmount: 100 }), order({ orderId: "p", totalAmount: 100 })];
    const m = computeMonth("2026-10", sales, orders, [expense(20)]);
    assert.equal(m.salesRevenue, 6000); // 30 + 30
    assert.equal(m.acctGross, 7000); // the company account's $70 royalty
    assert.equal(m.totalRevenue, 13000);
    assert.equal(m.georgeRoyalty, 1300); // 10% of 130
    assert.equal(m.enteredExpenses, 2000);
    assert.equal(m.otherExpenses, 3300); // entered + royalty, royalty once
    assert.equal(m.authorTax, 350); // 5% of 70
    assert.equal(m.profit, 13000 - 1300 - 2000 - 350); // 9350
    assert.equal(m.incomeTax, Math.round(9350 * 0.3)); // 30% of PROFIT, not revenue
    assert.equal(m.retained, 9350 - 2805);
  });

  test("income tax is on profit, never revenue", () => {
    const m = computeMonth("2026-10", [sale({ gross: 100, companyShare: 30, authorShare: 70 })], [order({ totalAmount: 100 })], [expense(10)]);
    assert.notEqual(m.incomeTax, Math.round(m.totalRevenue * 0.3));
    assert.equal(m.incomeTax, Math.round(m.profit * 0.3));
  });

  test("the 5% author-account tax is deducted before profit, so it lowers the income tax", () => {
    const a = computeMonth("m", [sale({ gross: 100, companyShare: 30, authorShare: 70, companyIsAuthor: true })], [order({ totalAmount: 100 })], []);
    // revenue 30 + 70 = 100; royalty 10; author tax 3.50; profit 86.50; income tax 25.95
    assert.equal(a.profit, 10000 - 1000 - 350);
    assert.equal(a.incomeTax, Math.round(8650 * 0.3));
  });

  test("a loss month has no income tax and nothing is carried over", () => {
    const m = computeMonth("m", [sale({ gross: 10, companyShare: 3, authorShare: 7 })], [order()], [expense(50)]);
    assert.ok(m.profit < 0);
    assert.equal(m.incomeTax, 0);
    assert.equal(m.retained, m.profit);
  });

  test("referral commissions are taken out of the company's 30%, never added on top", () => {
    // 18.00 sale: net 18 -> company 30% = 5.40, of which 0.90 goes to the referrer, leaving a stored company share of 4.50.
    const coherent = sale({ gross: 18, companyShare: 4.5, authorShare: 12.6, referralShare: 0.9 });
    const m = computeMonth("m", [coherent], [order({ totalAmount: 18 })], []);
    assert.equal(m.companyGrossShare, 540); // 30% of 18
    assert.equal(m.referralCommissions, 90);
    assert.equal(m.salesRevenue, 450); // 5.40 - 0.90
    assert.equal(m.salesRevenue, m.companyGrossShare - m.referralCommissions);
  });

  test("company author account: royalties, referral and promotion count in gross as their own line", () => {
    const rows = [
      sale({ lineId: "a", authorShare: 70, companyIsAuthor: true }),
      sale({ lineId: "b", referralShare: 2, companyIsReferrer: true, authorShare: 0 }),
      sale({ lineId: "c", affiliateShare: 4, companyIsPromoter: true, authorShare: 0 }),
      sale({ lineId: "d", authorShare: 99 }), // someone else's book: not the company's
    ];
    const m = computeMonth("m", rows, [], []);
    assert.equal(m.acctRoyalties, 7000);
    assert.equal(m.acctReferral, 200);
    assert.equal(m.acctPromotion, 400);
    assert.equal(m.acctGross, 7600);
  });

  test("Lulu printing, shipping and fulfillment are pass-through: never revenue, never cost", () => {
    const withPrint = computeMonth("m", [sale({ gross: 20, companyShare: 5.4, authorShare: 12.6, printingCost: 2, format: "paperback" })], [order({ totalAmount: 24, shipping: 3, fulfillment: 1 })], []);
    const without = computeMonth("m", [sale({ gross: 20, companyShare: 5.4, authorShare: 12.6, printingCost: 0 })], [order({ totalAmount: 20 })], []);
    assert.equal(withPrint.totalRevenue, without.totalRevenue);
    assert.equal(withPrint.profit, without.profit);
    assert.equal(withPrint.passThrough, 600);
    assert.equal(withPrint.luluShipping, 300);
    assert.equal(withPrint.luluFulfillment, 100);
  });

  test("money received reconciles to what customers paid", () => {
    // 20.00 book = printing 2.00 + company 5.40 + author 12.60; plus 3.00 shipping and 1.00 fulfillment = 24.00 paid.
    const m = computeMonth("m", [sale({ gross: 20, companyShare: 5.4, authorShare: 12.6, printingCost: 2 })], [order({ totalAmount: 24, shipping: 3, fulfillment: 1 })], []);
    assert.equal(m.unreconciled, 0);
    assert.equal(m.customersPaid, m.companyNet + m.authorRoyalties + m.referralEarnings + m.promotionCommissions + m.passThrough);
  });

  test("a difference that cannot be explained is shown, not hidden", () => {
    const m = computeMonth("m", [sale({ gross: 20, companyShare: 5.4, authorShare: 12.6, printingCost: 2 })], [order({ totalAmount: 25, shipping: 3, fulfillment: 1 })], []);
    assert.equal(m.unreconciled, 100);
  });

  test("lifetime is the sum of the months, field by field", () => {
    const a = computeMonth("2026-09", [sale({ gross: 100, companyShare: 30, authorShare: 70, companyIsAuthor: true })], [order({ totalAmount: 100 })], []);
    const b = computeMonth("2026-10", [sale({ gross: 10, companyShare: 3, authorShare: 7 })], [order()], [expense(50)]); // a loss month
    const t = sumMonths([a, b]);
    assert.equal(t.totalRevenue, a.totalRevenue + b.totalRevenue);
    assert.equal(t.profit, a.profit + b.profit);
    // Income tax is not worked out again on the lifetime profit: the loss month contributes 0, the profit month its own tax.
    assert.equal(t.incomeTax, a.incomeTax);
  });

  test("line contributions add up to the month figures", () => {
    const rows = [sale({ authorShare: 70, companyIsAuthor: true, companyShare: 30, referralShare: 1 }), sale({ lineId: "z", companyShare: 4, referralShare: 0.5, affiliateShare: 1, companyIsPromoter: true })];
    const m = computeMonth("m", rows, [], []);
    assert.equal(rows.reduce((s, r) => s + lineContribution(r, "salesRevenue"), 0), m.salesRevenue);
    assert.equal(rows.reduce((s, r) => s + lineContribution(r, "acctGross"), 0), m.acctGross);
    assert.equal(rows.reduce((s, r) => s + lineContribution(r, "referralCommissions"), 0), m.referralCommissions);
  });

  test("cents never drift on awkward amounts", () => {
    assert.equal(cents(0.1) + cents(0.2), cents(0.3));
    assert.equal(cents(1.005), 101);
  });

  test("the plain-words formulas cover all ten steps (step 9 is the Processing Fee)", () => {
    assert.equal(FORMULA_STEPS.length, 10);
    assert.ok(FORMULA_STEPS.some((s) => /30%/.test(s.words) && /profit/i.test(s.words)));
  });
});

describe("months (Nairobi time)", () => {
  test("a sale just after midnight in Nairobi belongs to the new month", () => {
    assert.equal(monthKeyOf(new Date("2026-10-31T21:30:00Z")), "2026-11"); // 00:30 on 1 Nov in Nairobi
    assert.equal(monthKeyOf(new Date("2026-10-31T20:30:00Z")), "2026-10");
  });
  test("bounds are contiguous and exact", () => {
    const oct = monthBounds("2026-10");
    assert.equal(oct.end.getTime(), monthBounds("2026-11").start.getTime());
    assert.equal(oct.start.toISOString(), "2026-09-30T21:00:00.000Z");
  });
  test("last day of the month", () => {
    assert.equal(isLastDayOfMonth(new Date("2026-10-31T14:00:00Z")), true);
    assert.equal(isLastDayOfMonth(new Date("2026-10-30T14:00:00Z")), false);
    assert.equal(isLastDayOfMonth(new Date("2026-02-28T10:00:00Z")), true);
    assert.equal(isLastDayOfMonth(new Date("2028-02-28T10:00:00Z")), false); // leap year
    // 21:30 UTC on 30 Sep is already 1 Oct in Nairobi, so not the last day.
    assert.equal(isLastDayOfMonth(new Date("2026-09-30T21:30:00Z")), false);
  });
  test("month helpers", () => {
    assert.equal(nextMonthKey("2026-12"), "2027-01");
    assert.equal(previousMonthKey("2026-01"), "2025-12");
    assert.deepEqual(monthRange("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
    assert.equal(isMonthKey("2026-13"), false);
    assert.equal(isDateString("2026-02-30"), false);
    assert.equal(isDateString("2026-02-28"), true);
  });
});

describe("expense input", () => {
  test("amounts", () => {
    assert.equal(parseAmountToCents("1,234.50"), 123450);
    assert.equal(parseAmountToCents("$20"), 2000);
    assert.equal(parseAmountToCents("0"), null);
    assert.equal(parseAmountToCents("-5"), null);
    assert.equal(parseAmountToCents("1.234"), null);
    assert.equal(parseAmountToCents("abc"), null);
    assert.equal(parseAmountToCents(5), null);
  });
  test("a valid expense is accepted and its month comes from the date as typed", () => {
    const r = validateExpense({ date: "2026-10-31", category: " Hosting ", description: " Vercel plan ", amount: "20" });
    assert.ok(r.ok);
    if (r.ok) { assert.equal(r.value.monthKey, "2026-10"); assert.equal(r.value.category, "Hosting"); assert.equal(r.value.amountCents, 2000); }
  });
  test("bad expenses are refused with a reason", () => {
    assert.equal(validateExpense({ date: "nope", category: "a", description: "bb", amount: "1" }).ok, false);
    assert.equal(validateExpense({ date: "2026-10-01", category: "", description: "bb", amount: "1" }).ok, false);
    assert.equal(validateExpense({ date: "2026-10-01", category: "a", description: "b", amount: "1" }).ok, false);
    assert.equal(validateExpense({ date: "2026-10-01", category: "a", description: "bb", amount: "0" }).ok, false);
  });
  test("receipts: type, size and real content", () => {
    assert.equal(receiptProblem({ name: "a.pdf", type: "application/pdf", size: 100 }), null);
    assert.equal(receiptProblem({ name: "a.exe", type: "application/x-msdownload", size: 100 }) === null, false);
    assert.equal(receiptProblem({ name: "a.pdf", type: "application/pdf", size: 5 * 1024 * 1024 }) === null, false);
    assert.equal(sniffReceiptType(new TextEncoder().encode("%PDF-1.7 ...")), "application/pdf");
    assert.equal(sniffReceiptType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(sniffReceiptType(new TextEncoder().encode("<script>alert(1)</script>")), null);
  });
});

describe("payouts owed", () => {
  const e = (userId: string, amount: number, when: string, kind: "AUTHOR" | "AFFILIATE" = "AUTHOR"): EarningRow => ({ userId, userName: userId, accountNumber: "1", kind, type: "ROYALTY", createdAt: new Date(when), amount, orderRef: "x", bookTitle: "t" });
  const p = (userId: string, amount: number, status: string, req: string, res: string | null): PayoutRow => ({ id: "p", reference: "r", userId, recipientName: userId, accountNumber: "1", kind: "AUTHOR", amount, status, method: "Bank", requestedAt: new Date(req), resolvedAt: res ? new Date(res) : null, coversMonth: "2026-09" });

  test("earned minus paid is owed; this month's earnings are held back", () => {
    const rows = computeOwed([e("a", 40, "2026-09-10"), e("a", 10, "2026-10-10")], [p("a", 40, "PAID", "2026-10-15", "2026-10-16")], new Date("2026-10-20"), 30);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].earned, 50);
    assert.equal(rows[0].paid, 40);
    assert.equal(rows[0].owed, 10);
    assert.equal(rows[0].onHold, 10);
    assert.equal(rows[0].available, 0);
  });
  test("released money under the minimum is flagged as below the minimum", () => {
    const rows = computeOwed([e("a", 12, "2026-09-10")], [], new Date("2026-10-20"), 30);
    assert.equal(rows[0].available, 12);
    assert.equal(rows[0].belowMinimum, true);
    assert.equal(totalOwed(rows).belowMinimum, 12);
  });
  test("a queued payout is not available again", () => {
    const rows = computeOwed([e("a", 50, "2026-09-10")], [p("a", 50, "REQUESTED", "2026-10-15", null)], new Date("2026-10-20"), 30);
    assert.equal(rows[0].queued, 50);
    assert.equal(rows[0].available, 0);
    assert.equal(rows[0].owed, 50);
  });
  test("looking back: a payout paid after that date was still owed then", () => {
    const rows = computeOwed([e("a", 50, "2026-08-10")], [p("a", 50, "PAID", "2026-10-15", "2026-10-16")], new Date("2026-10-01"), 30);
    assert.equal(rows[0].owed, 50);
    assert.equal(rows[0].paid, 0);
  });
  test("authors and affiliates are kept apart", () => {
    const rows = computeOwed([e("a", 40, "2026-09-10"), e("a", 40, "2026-09-10", "AFFILIATE")], [], new Date("2026-10-20"), 30);
    assert.equal(rows.length, 2);
  });
});

describe("exports", () => {
  const t = (cell: string): ExportTable => ({ title: "t", subtitle: "s", headers: ["a"], aligns: ["left"], rows: [[cell]], filename: "f" });
  test("CSV quotes cells and defuses spreadsheet formulas", () => {
    assert.equal(toCsv(t("=SUM(A1)")), '"a"\r\n"\'=SUM(A1)"\r\n');
    assert.equal(toCsv(t("+1")), '"a"\r\n"\'+1"\r\n');
    assert.equal(toCsv(t('say "hi"')), '"a"\r\n"say ""hi"""\r\n');
    assert.equal(toCsv(t("-12.50")), '"a"\r\n"-12.50"\r\n'); // a plain negative number stays a number
    assert.equal(toCsv(t("-cmd")), '"a"\r\n"\'-cmd"\r\n');
  });
});

describe("charts", () => {
  test("a bar chart has a 3D front, top and side face per bar, and supports negatives", () => {
    const s = barChartScene({ title: "t", categories: ["a", "b"], series: [{ name: "x", values: [10, -5] }] });
    assert.equal(s.shapes.filter((x) => x.t === "poly").length, 6);
    assert.match(s.alt, /a \$10\.00/);
  });
  test("the pie only draws slices above zero and says so when empty", () => {
    const pie = pieChartScene({ title: "p", slices: [{ label: "a", value: 3 }, { label: "b", value: 0 }, { label: "c", value: 1 }] });
    assert.equal(pie.shapes.filter((x) => x.t === "text" && x.s === "b").length, 0);
    const empty = pieChartScene({ title: "p", slices: [{ label: "a", value: 0 }] });
    assert.ok(empty.shapes.some((x) => x.t === "text" && /No money/.test(x.s)));
  });
  test("a single slice makes a full disc", () => {
    const pie = pieChartScene({ title: "p", slices: [{ label: "a", value: 5 }] });
    assert.ok(pie.shapes.some((x) => x.t === "path"));
  });
  test("axis and shading helpers", () => {
    const ax = niceAxis(-30, 1180);
    assert.ok(ax.lo <= -30 && ax.hi >= 1180);
    assert.equal(shade("#000000", 1), "#ffffff");
    assert.equal(shade("#ffffff", -1), "#000000");
  });
  test("path scaling keeps arc flags", () => {
    assert.equal(scalePath("M 10 20 A 100 50 0 1 1 30 40 Z", 2), "M 20.00 40.00 A 200.00 100.00 0 1 1 60.00 80.00 Z");
  });
});

describe("the monthly PDF", () => {
  test("builds a real multi-page PDF from a saved snapshot", async () => {
    const figures = computeMonth("2026-10", [sale({ gross: 20, companyShare: 5.4, authorShare: 12.6, printingCost: 2 })], [order({ totalAmount: 24, shipping: 3, fulfillment: 1 })], [expense(5)]);
    const bytes = await buildMonthlyReportPdf({
      monthKey: "2026-10", version: 2, closedAt: new Date().toISOString(), closedBy: "Test",
      snapshot: {
        version: 1, takenAt: "", includeTest: true, figures, expenses: [expense(5)], payouts: [], payoutsPaidTotal: 0,
        owed: { owed: 0, queued: 0, onHold: 0, available: 0, belowMinimum: 0, people: 0 }, owedRows: [],
        lulu: { orders: 0, paidBooks: 0, paidProduction: 0, paidShipping: 0, paidFulfillment: 0, luluProduction: 0, luluShipping: 0, luluFulfillment: 0, luluTotal: 0, productionDifference: 0, shippingDifference: 0, fulfillmentDifference: 0, totalDifference: 0, grandDifference: 0 },
        luluOrders: 0, companyBooksPublished: 1, testOrders: 1, trend: [{ label: "Oct 26", revenue: 10, costs: 4, profit: 6 }],
      },
    });
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
    assert.ok(bytes.length > 5000);
  });
  const snap = () => {
    const figures = computeMonth("2026-10", [sale()], [order()], []);
    return {
      version: 1 as const, takenAt: "", includeTest: true, figures, expenses: [], payouts: [], payoutsPaidTotal: 0,
      owed: { owed: 0, queued: 0, onHold: 0, available: 0, belowMinimum: 0, people: 0 }, owedRows: [],
      lulu: { orders: 0, paidBooks: 0, paidProduction: 0, paidShipping: 0, paidFulfillment: 0, luluProduction: 0, luluShipping: 0, luluFulfillment: 0, luluTotal: 0, productionDifference: 0, shippingDifference: 0, fulfillmentDifference: 0, totalDifference: 0, grandDifference: 0 },
      luluOrders: 0, companyBooksPublished: 1, testOrders: 0, trend: [{ label: "Oct 26", revenue: 10, costs: 4, profit: 6 }],
    };
  };
  test("a draft with test data is a real PDF, and the Test Data watermark and Draft marking make it bigger than a plain one", async () => {
    const plain = await buildMonthlyReportPdf({ monthKey: "2026-10", version: 1, closedAt: new Date().toISOString(), closedBy: "T", snapshot: snap() });
    const draftTest = await buildMonthlyReportPdf({ monthKey: "2026-10", version: 0, closedAt: null, closedBy: null, draft: true, testData: true, snapshot: snap() });
    assert.equal(new TextDecoder().decode(draftTest.slice(0, 5)), "%PDF-");
    assert.ok(draftTest.length > plain.length, "extra drawing operations were added");
  });
  test("a year report builds", async () => {
    const bytes = await buildMonthlyReportPdf({ monthKey: "2026-01", version: 1, closedAt: null, closedBy: null, draft: true, draftLabel: "Draft, Not All Months Closed", period: { kind: "year", label: "2026" }, snapshot: snap() });
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  });
  test("the report source carries the labels", () => {
    const r = readFileSync(new URL("../lib/accounting/report-pdf.ts", import.meta.url), "utf8");
    assert.match(r, /Draft, Month Not Closed/);
    assert.match(r, /"TEST DATA"/);
    const route = readFileSync(new URL("../app/api/accounting/report/route.ts", import.meta.url), "utf8");
    assert.match(route, /draft: true/);
  });
  test("a test-data table export is labelled in the title, file name, CSV and PDF", () => {
    const t: ExportTable = { title: "X (TEST DATA)", subtitle: "s", headers: ["a"], aligns: ["left"], rows: [["1"]], filename: "f-test-data", testData: true };
    assert.match(toCsv(t), /^"TEST DATA: these figures are test/);
  });
});

describe("investors are view-only, enforced on the server", () => {
  const actions = readFileSync(new URL("../actions/accounting.ts", import.meta.url), "utf8");

  test("every write action checks for an Admin before doing anything", () => {
    for (const name of ["saveExpense", "reverseExpense", "closeMonth", "reopenMonth", "resendReport"]) {
      const i = actions.indexOf(`export async function ${name}(`);
      assert.ok(i >= 0, `${name} exists`);
      const body = actions.slice(i, i + 400);
      assert.match(body, /await accountingAdmin\(\)/, `${name} checks accountingAdmin()`);
      assert.match(body, /NOT_ADMIN/, `${name} refuses a non-admin`);
    }
  });
  test("the read actions use the viewer check (admin or investor), never anything wider", () => {
    for (const name of ["getAccountingView", "getAccountingDrill"]) {
      const i = actions.indexOf(`export async function ${name}(`);
      assert.match(actions.slice(i, i + 300), /await accountingViewer\(\)/);
    }
  });
  test("the guard allows exactly ADMIN and INVESTOR, and only ADMIN to write", () => {
    const g = readFileSync(new URL("../lib/accounting/guard.ts", import.meta.url), "utf8");
    assert.match(g, /role !== "ADMIN" && role !== "INVESTOR"/);
    assert.match(g, /a\.role === "ADMIN"/);
  });
  test("every download (exports and reports) is Admin only; the receipt viewer stays view-only", () => {
    for (const f of ["../app/api/accounting/export/route.ts", "../app/api/accounting/report/route.ts"]) {
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      assert.match(src, /await accountingAdmin\(\)/, f);
      assert.doesNotMatch(src, /accountingViewer/, f);
    }
    assert.match(readFileSync(new URL("../app/api/accounting/receipt/[id]/route.ts", import.meta.url), "utf8"), /await accountingViewer\(\)/);
  });
  test("the archive and restore actions are Admin only and need the typed phrase", () => {
    for (const name of ["archiveTestData", "restoreTestData"]) {
      const i = actions.indexOf(`export async function ${name}(`);
      assert.ok(i >= 0, name);
      assert.match(actions.slice(i, i + 300), /await accountingAdmin\(\)/, name);
    }
    assert.match(actions, /confirmText\.trim\(\) !== ARCHIVE_PHRASE/);
  });
  test("an investor sees no download buttons on the Accounting tab", () => {
    const c = readFileSync(new URL("../components/accounting/AccountingClient.tsx", import.meta.url), "utf8");
    assert.match(c, /show=\{!readOnly\}/);
    assert.match(c, /\{!readOnly && \(\s*<div[^>]*>\s*\{isMonth && <a className="btn btn-primary btn-small" href=\{`\/api\/accounting\/report/);
    assert.match(c, /canDownload=\{!readOnly\}/);
  });
  test("the Lulu refresh and webhook actions stay Admin only; reading is open to the viewer check", () => {
    const l = readFileSync(new URL("../actions/admin-lulu.ts", import.meta.url), "utf8");
    assert.match(l, /export async function getLuluReport[\s\S]{0,300}accountingViewer\(\)/);
    assert.match(l, /export async function refreshFromLulu[\s\S]{0,200}isAdmin\(\)/);
    assert.match(l, /export async function registerLuluWebhook[\s\S]{0,200}isAdmin\(\)/);
  });
  test("an investor no longer reaches financial data elsewhere", () => {
    assert.equal(canViewFinancials("INVESTOR"), false);
    assert.equal(canViewFinancials("ADMIN"), true);
    assert.deepEqual(PERMISSIONS.INVESTOR.sort(), ["accounting:view", "lulu:view"]);
    assert.doesNotMatch(readFileSync(new URL("../actions/payout-ledger.ts", import.meta.url), "utf8"), /role !== "INVESTOR"|"INVESTOR"\)\) \{/);
  });
  test("the reminder job refuses to run without the secret and compares it safely", () => {
    const r = readFileSync(new URL("../app/api/cron/accounting-reminder/route.ts", import.meta.url), "utf8");
    assert.match(r, /if \(!secret\)/);
    assert.match(r, /timingSafeEqual/);
  });
  test("the report is only ever sent from closing a month or the Re-send button", () => {
    const c = readFileSync(new URL("../lib/accounting/close.ts", import.meta.url), "utf8");
    assert.equal((c.match(/sendMonthlyReport\(/g) ?? []).length, 3); // definition + close + resend
    assert.doesNotMatch(c.slice(c.indexOf("export async function runMonthEndReminder")), /sendMonthlyReport|sendEmail/);
  });
});
