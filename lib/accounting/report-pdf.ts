import type { PDFPage } from "pdf-lib";
import { barChartScene, pieChartScene, PALETTE } from "@/lib/accounting/charts";
import { FORMULA_STEPS, dollars } from "@/lib/accounting/calc";
import type { MonthSnapshot } from "@/lib/accounting/service";
import { monthLabel } from "@/lib/accounting/period";
import { PLUM, INK, SOFT, RULE, TINT, WHITE, drawScene, drawTable, newDoc, safe } from "@/lib/accounting/pdf-draw";

/**
 * The monthly accounting report (PDF). Built ONLY from the saved snapshot of a closed month, so it shows exactly the locked
 * figures. Library: pdf-lib (pure JavaScript, runs on Vercel). The 3D-style charts are drawn from the same scenes as the
 * Accounting tab (lib/accounting/charts.ts).
 */

export interface ReportInput {
  monthKey: string;
  snapshot: MonthSnapshot;
  /** 1 for the first report of the month; higher once the month was reopened and closed again. */
  version: number;
  closedAt: string;
  closedBy: string;
  generatedAt?: Date;
}

const usd = (cents: number): string => {
  const n = dollars(cents);
  const a = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${a}`;
};
const usdD = (n: number): string => usd(Math.round(n * 100));

const A4 = { w: 595.28, h: 841.89 };
const M = 40;

export async function buildMonthlyReportPdf(input: ReportInput): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc();
  const f = input.snapshot.figures;
  const label = monthLabel(input.monthKey);
  const corrected = input.version > 1;
  const generated = (input.generatedAt ?? new Date()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Africa/Nairobi" });
  const contentW = A4.w - M * 2;

  let page = doc.addPage([A4.w, A4.h]);
  const pages: PDFPage[] = [page];

  const footer = (p: PDFPage, n: number) => {
    p.drawLine({ start: { x: M, y: 34 }, end: { x: A4.w - M, y: 34 }, thickness: 0.5, color: RULE });
    p.drawText(safe(`The Good Child Bookstore LTD  |  ${label} accounting report${corrected ? " (CORRECTED)" : ""}  |  Generated ${generated}`), { x: M, y: 22, size: 7, font: fonts.regular, color: SOFT });
    const t = `Page ${n}`;
    p.drawText(t, { x: A4.w - M - fonts.regular.widthOfTextAtSize(t, 7), y: 22, size: 7, font: fonts.regular, color: SOFT });
  };
  const newPage = (): number => {
    page = doc.addPage([A4.w, A4.h]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: A4.h - 34, width: A4.w, height: 34, color: PLUM });
    page.drawText(safe(`${label} accounting report${corrected ? " - CORRECTED" : ""}`), { x: M, y: A4.h - 22, size: 10, font: fonts.bold, color: WHITE });
    return A4.h - 56;
  };
  const text = (s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: typeof INK; right?: boolean } = {}) => {
    const font = o.bold ? fonts.bold : fonts.regular;
    const size = o.size ?? 9;
    const t = safe(s);
    const tx = o.right ? x - font.widthOfTextAtSize(t, size) : x;
    page.drawText(t, { x: tx, y, size, font, color: o.color ?? INK });
  };
  const heading = (s: string, y: number): number => {
    text(s, M, y, { size: 12, bold: true, color: PLUM });
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: A4.w - M, y: y - 4 }, thickness: 0.8, color: PLUM });
    return y - 20;
  };
  const ensure = (y: number, need: number): number => (y - need < 52 ? newPage() : y);

  // ---------- Page 1: cover ----------
  page.drawRectangle({ x: 0, y: A4.h - 110, width: A4.w, height: 110, color: PLUM });
  text("The Good Child Bookstore LTD", M, A4.h - 42, { size: 11, bold: true, color: WHITE });
  text("Monthly Accounting Report", M, A4.h - 72, { size: 24, bold: true, color: WHITE });
  text(label, M, A4.h - 94, { size: 14, color: WHITE });
  if (corrected) {
    page.drawRectangle({ x: A4.w - M - 120, y: A4.h - 80, width: 120, height: 24, color: WHITE });
    text("CORRECTED REPORT", A4.w - M - 60 - fonts.bold.widthOfTextAtSize("CORRECTED REPORT", 10) / 2, A4.h - 72, { size: 10, bold: true, color: PLUM });
  }
  let y = A4.h - 134;
  text(`Month closed ${new Date(input.closedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Africa/Nairobi" })} by ${input.closedBy}. Report version ${input.version}. All amounts in US dollars.`, M, y, { size: 8.5, color: SOFT });
  y -= 12;
  if (input.snapshot.testOrders > 0) {
    text(input.snapshot.includeTest
      ? `Note: these figures include ${input.snapshot.testOrders} order(s) paid with test (sandbox) money, so they are test data and not real money.`
      : "Note: orders paid with test (sandbox) money are excluded from these figures.", M, y, { size: 8.5, bold: true, color: PLUM });
    y -= 12;
  }
  y -= 8;

  // Key figure tiles
  const tiles: [string, number][] = [["Total revenue", f.totalRevenue], ["Profit", f.profit], ["Income tax (30%)", f.incomeTax], ["Retained", f.retained]];
  const tw = (contentW - 18) / 4;
  tiles.forEach(([t, v], i) => {
    const x = M + i * (tw + 6);
    page.drawRectangle({ x, y: y - 52, width: tw, height: 52, color: TINT });
    page.drawRectangle({ x, y: y - 52, width: 3, height: 52, color: PLUM });
    text(t, x + 10, y - 18, { size: 8, color: SOFT });
    text(usd(v), x + 10, y - 38, { size: 14, bold: true, color: INK });
  });
  y -= 72;

  y = heading("The calculation", y);
  const calc: [string, string, number, boolean?][] = [
    ["1", "Company sales revenue (30% share, after referral commissions)", f.salesRevenue],
    ["", `    30% share before referral commissions ${usd(f.companyGrossShare)}, less referral commissions ${usd(f.referralCommissions)}`, NaN],
    ["2", "Company author account 30000064 earnings (gross)", f.acctGross],
    ["", `    royalties ${usd(f.acctRoyalties)}, referral ${usd(f.acctReferral)}, promotion ${usd(f.acctPromotion)}`, NaN],
    ["3", "Total revenue (before tax)", f.totalRevenue, true],
    ["4", "Royalty to George Otieno (10% of total revenue)", -f.georgeRoyalty],
    ["5", "Expenses entered by the admin", -f.enteredExpenses],
    ["", `    Other company expenses in total (entered + royalty) ${usd(f.otherExpenses)}`, NaN],
    ["6", "Tax on the author account (5% of its earnings)", -f.authorTax],
    ["7", "Profit", f.profit, true],
    ["8", "Income tax (30% of profit)", -f.incomeTax],
    ["", "Retained by the company after income tax", f.retained, true],
  ];
  for (const [n, name, v, b] of calc) {
    y = ensure(y, 16);
    if (b) page.drawRectangle({ x: M, y: y - 5, width: contentW, height: 15, color: TINT });
    text(n, M + 4, y, { size: 8.5, bold: true, color: PLUM });
    text(name, M + 22, y, { size: 8.5, bold: !!b, color: Number.isNaN(v) ? SOFT : INK });
    if (!Number.isNaN(v)) text(usd(v), A4.w - M - 4, y, { size: 8.5, bold: !!b, right: true });
    y -= 15;
  }
  y -= 4;
  text(`Books published in the company author account: ${input.snapshot.companyBooksPublished}`, M, y, { size: 8.5, color: SOFT });
  y -= 22;

  y = heading("How each figure is worked out", y);
  for (const s of FORMULA_STEPS) {
    const words = safe(`${s.n}. ${s.title}: ${s.words}`);
    // simple word wrap
    let line = "";
    const lines: string[] = [];
    for (const w of words.split(" ")) {
      const next = line ? `${line} ${w}` : w;
      if (fonts.regular.widthOfTextAtSize(next, 8) > contentW - 6) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    y = ensure(y, lines.length * 10 + 4);
    for (const l of lines) { text(l, M + 2, y, { size: 8 }); y -= 10; }
    y -= 3;
  }

  // ---------- Page 2: charts ----------
  y = newPage();
  y = heading("Charts", y);
  const trend = input.snapshot.trend ?? [];
  const chartA = barChartScene({
    title: "Revenue, costs and profit - last 12 months",
    categories: trend.map((t) => t.label),
    series: [
      { name: "Total revenue", values: trend.map((t) => t.revenue), color: PALETTE[0] },
      { name: "Costs (royalty, expenses, author tax)", values: trend.map((t) => t.costs), color: PALETTE[2] },
      { name: "Profit", values: trend.map((t) => t.profit), color: PALETTE[1] },
    ],
    width: 720, height: 320,
  });
  y -= drawScene(page, fonts, chartA, M, y, contentW) + 14;
  const pieSlices = [
    { label: "Company share (after referral commissions)", value: dollars(f.companyNet) },
    { label: "Author royalties", value: dollars(f.authorRoyalties) },
    { label: "Referral earnings", value: dollars(f.referralEarnings) },
    { label: "Promotion commissions", value: dollars(f.promotionCommissions) },
    { label: "Pass-through to Lulu: printing", value: dollars(f.luluPrinting) },
    { label: "Pass-through to Lulu: shipping", value: dollars(f.luluShipping) },
    { label: "Pass-through to Lulu: fulfillment fee", value: dollars(f.luluFulfillment) },
  ];
  const pie = pieChartScene({ title: `Where customers' money went - ${label}`, slices: pieSlices, width: 720, height: 250 });
  y -= drawScene(page, fonts, pie, M, y, contentW) + 14;
  const flow = barChartScene({
    title: `From revenue to retained - ${label}`,
    categories: ["Total revenue", "Royalty 10%", "Expenses", "Author tax 5%", "Profit", "Income tax 30%", "Retained"],
    series: [{ name: "Amount", values: [f.totalRevenue, f.georgeRoyalty, f.enteredExpenses, f.authorTax, f.profit, f.incomeTax, f.retained].map(dollars), color: PALETTE[0] }],
    width: 720, height: 270, valueLabels: true,
  });
  drawScene(page, fonts, flow, M, y, contentW);

  // ---------- Page 3: money received + payouts ----------
  y = newPage();
  y = heading("Breakdown of all money received", y);
  const received: string[][] = [
    ["Company share (30%, after referral commissions)", usd(f.companyNet)],
    ["Author royalties (all authors)", usd(f.authorRoyalties)],
    ["Referral earnings", usd(f.referralEarnings)],
    ["Promotion commissions", usd(f.promotionCommissions)],
    ["Pass-through to Lulu: printing cost", usd(f.luluPrinting)],
    ["Pass-through to Lulu: shipping", usd(f.luluShipping)],
    ["Pass-through to Lulu: fulfillment fee", usd(f.luluFulfillment)],
    ["Difference not explained (should be $0.00)", usd(f.unreconciled)],
    ["Total paid by customers (" + f.orders + " orders)", usd(f.customersPaid)],
  ];
  y = drawTable({ fonts, getPage: () => page, onNewPage: newPage, x: M, y, width: contentW, cols: [{ label: "Item", w: 0.74 }, { label: "Amount", w: 0.26, align: "right" }], rows: received, bottom: 56, boldLast: true });
  y -= 6;
  text("Lulu printing, shipping and the fulfillment fee are paid by customers and passed to Lulu. They are never company revenue or cost.", M, y, { size: 7.5, color: SOFT });
  y -= 24;

  y = ensure(y, 120);
  y = heading("Payouts summary", y);
  const o = input.snapshot.owed;
  y = drawTable({
    fonts, getPage: () => page, onNewPage: newPage, x: M, y, width: contentW,
    cols: [{ label: "Item", w: 0.74 }, { label: "Amount", w: 0.26, align: "right" }],
    rows: [
      [`Paid out to authors and affiliates in ${label} (${input.snapshot.payouts.length} payouts)`, usdD(input.snapshot.payoutsPaidTotal)],
      ["Still owed at month end (earned, not yet paid)", usdD(o.owed)],
      ["  of which held back (not yet released)", usdD(o.onHold)],
      ["  of which queued for payment", usdD(o.queued)],
      ["  of which released and available", usdD(o.available)],
      ["  of which below the minimum payout (rolls to next month)", usdD(o.belowMinimum)],
    ],
    bottom: 56,
  });
  y -= 6;
  text("Payouts are money owed to authors and affiliates. They do not reduce company revenue.", M, y, { size: 7.5, color: SOFT });
  y -= 22;

  if (input.snapshot.payouts.length > 0) {
    y = ensure(y, 60);
    y = heading("Payouts made this month", y);
    y = drawTable({
      fonts, getPage: () => page, onNewPage: newPage, x: M, y, width: contentW, size: 7.5,
      cols: [{ label: "Date", w: 0.11 }, { label: "Recipient", w: 0.22 }, { label: "Type", w: 0.09 }, { label: "Method", w: 0.2 }, { label: "Reference", w: 0.18 }, { label: "Covers", w: 0.08 }, { label: "Amount", w: 0.12, align: "right" }],
      rows: input.snapshot.payouts.map((p) => [p.date.slice(0, 10), p.recipient, p.kind === "AUTHOR" ? "Author" : "Affiliate", p.method, p.reference, p.coversMonth, usdD(p.amount)]),
      bottom: 56,
    });
    y -= 16;
  }

  y = ensure(y, 100);
  y = heading("Expenses", y);
  if (input.snapshot.expenses.length === 0) {
    text("No expenses were entered for this month.", M, y, { size: 8.5, color: SOFT });
    y -= 16;
  } else {
    y = drawTable({
      fonts, getPage: () => page, onNewPage: newPage, x: M, y, width: contentW, size: 7.5,
      cols: [{ label: "Date", w: 0.12 }, { label: "Category", w: 0.2 }, { label: "Description", w: 0.52 }, { label: "Amount", w: 0.16, align: "right" }],
      rows: input.snapshot.expenses.map((e) => [e.date, e.category, e.description, usdD(e.amount)]),
      bottom: 56,
    });
    y -= 16;
  }

  y = ensure(y, 110);
  y = heading("Lulu printing: what customers paid and what Lulu charges", y);
  const L = input.snapshot.lulu;
  drawTable({
    fonts, getPage: () => page, onNewPage: newPage, x: M, y, width: contentW,
    cols: [{ label: `Print orders: ${input.snapshot.luluOrders}`, w: 0.46 }, { label: "Customers paid", w: 0.18, align: "right" }, { label: "Lulu charges", w: 0.18, align: "right" }, { label: "Difference", w: 0.18, align: "right" }],
    rows: [
      ["Production printing", usdD(L.paidProduction), usdD(L.luluProduction), usdD(L.productionDifference)],
      ["Shipping", usdD(L.paidShipping), usdD(L.luluShipping), usdD(L.shippingDifference)],
      ["Fulfillment fee", usdD(L.paidFulfillment), usdD(L.luluFulfillment), usdD(L.fulfillmentDifference)],
      ["Total", usdD(L.paidProduction + L.paidShipping + L.paidFulfillment), usdD(L.luluTotal), usdD(L.grandDifference)],
    ],
    bottom: 56, boldLast: true,
  });
  pages.forEach((p, i) => footer(p, i + 1));
  return doc.save();
}
