import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProcessingFee, printAmountDue, refundedFeeShare, gatewayFeeFromPayload, estimateGatewayCost, normalizeRates, DEFAULT_FEE_RATES } from "../lib/processing-fee";
import { computeMonth, sumMonths, type OrderRow, type SaleRow } from "../lib/accounting/calc";

const PP = DEFAULT_FEE_RATES.paypal;
const PS = DEFAULT_FEE_RATES.paystack;

test("processing fee: the company receives the amount due, to within one cent, for many amounts and both gateways", () => {
  for (const gw of [PP, PS, { rate: 0.039, fixed: 0.3 }]) {
    for (let cents = 100; cents <= 20000; cents += 37) {
      const due = cents / 100;
      const r = computeProcessingFee(due, gw);
      const kept = Math.round((r.chargedOnPrint * gw.rate + gw.fixed) * 100) / 100;
      const received = Math.round((r.chargedOnPrint - kept) * 100) / 100;
      assert.ok(received >= due - 0.0101 && received <= due + 0.0201, `due ${due} received ${received}`);
      assert.ok(r.fee > 0);
      assert.equal(Math.round(r.chargedOnPrint * 100), Math.round(due * 100) + Math.round(r.fee * 100));
    }
  }
});

test("processing fee: known value and no fee when nothing printed", () => {
  const r = computeProcessingFee(20, PP);
  assert.equal(r.chargedOnPrint, Math.ceil(((20 + 0.49) / (1 - 0.0349)) * 100) / 100);
  assert.equal(computeProcessingFee(0, PP).fee, 0);
  assert.equal(printAmountDue({ printLinesTotal: 0, shipping: 5, fulfillment: 2 }), 0);
});

test("mixed basket: the fee is worked out on the print part only", () => {
  const due = printAmountDue({ printLinesTotal: 12.5, shipping: 4, fulfillment: 1.5 });
  assert.equal(due, 18);
  assert.equal(computeProcessingFee(due, PS).amountDue, 18);
});

test("refund share is proportional and never above the fee", () => {
  assert.equal(refundedFeeShare(100, 4, 50), 2);
  assert.equal(refundedFeeShare(100, 4, 200), 4);
  assert.equal(refundedFeeShare(100, 0, 50), 0);
});

test("gateway payload parsing", () => {
  assert.equal(gatewayFeeFromPayload("PAYSTACK", { data: { fees: 150, currency: "USD" } }), 1.5);
  assert.equal(gatewayFeeFromPayload("PAYSTACK", { data: { fees: 150, currency: "KES" } }), null);
  assert.equal(gatewayFeeFromPayload("PAYSTACK", {}), null);
  assert.equal(gatewayFeeFromPayload("PAYPAL", { captured: { purchase_units: [{ payments: { captures: [{ seller_receivable_breakdown: { paypal_fee: { currency_code: "USD", value: "0.99" } } }] } }] } }), 0.99);
  assert.equal(gatewayFeeFromPayload("PAYPAL", null), null);
  assert.equal(estimateGatewayCost(100, PP), 3.98);
});

test("rates: invalid saved values fall back to defaults", () => {
  const r = normalizeRates({ paypal: { rate: 9, fixed: 0 }, paystack: { rate: 0.025, fixed: 0 } });
  assert.deepEqual(r.paypal, DEFAULT_FEE_RATES.paypal);
  assert.equal(r.paystack.rate, 0.025);
});

const sale = (over: Partial<SaleRow> = {}): SaleRow => ({ lineId: "l", orderId: "o", orderRef: "O", createdAt: new Date("2026-11-02"), bookTitle: "B", format: "paperback", gross: 20, companyShare: 3, authorShare: 7, affiliateShare: 0, referralShare: 0, printingCost: 10, companyIsAuthor: false, companyIsReferrer: false, companyIsPromoter: false, isTest: false, ...over });

test("accounting: only the NET of fees and gateway costs reaches revenue, royalty, profit and tax; books still tie", () => {
  const order: OrderRow = { orderId: "o", orderRef: "O", createdAt: new Date("2026-11-02"), totalAmount: 20 + 5 + 1 + 1.2, shipping: 5, fulfillment: 1, processingFee: 1.2, processingFeeRefunded: 0, gatewayCost: 0.9, isTest: false };
  const base = computeMonth("2026-11", [sale()], [{ ...order, processingFee: 0, totalAmount: 26, gatewayCost: 0 }], []);
  const m = computeMonth("2026-11", [sale()], [order], []);
  assert.equal(m.processingFeesCollected, 120);
  assert.equal(m.gatewayCosts, 90);
  assert.equal(m.processingNet, 30);
  assert.equal(m.totalRevenue - base.totalRevenue, 30);
  assert.equal(m.georgeRoyalty - base.georgeRoyalty, Math.round(m.totalRevenue * 0.1) - Math.round(base.totalRevenue * 0.1));
  assert.equal(m.unreconciled, 0);
  assert.equal(base.unreconciled, 0);
  assert.equal(m.authorRoyalties, base.authorRoyalties);
});

test("accounting: a refunded fee lowers fees collected; old closed-month snapshots without the new fields still sum", () => {
  const order: OrderRow = { orderId: "o", orderRef: "O", createdAt: new Date("2026-11-02"), totalAmount: 27.2, shipping: 5, fulfillment: 1, processingFee: 1.2, processingFeeRefunded: 0.6, gatewayCost: 0.9, isTest: false };
  const m = computeMonth("2026-11", [sale()], [order], []);
  assert.equal(m.processingFeesCollected, 60);
  assert.equal(m.processingNet, -30);
  const old = { ...m } as Record<string, unknown>;
  delete old.processingNet; delete old.gatewayCosts;
  const total = sumMonths([old as unknown as typeof m, m]);
  assert.ok(Number.isFinite(total.processingNet));
});
