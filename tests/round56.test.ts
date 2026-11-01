import test from "node:test";
import assert from "node:assert/strict";
import { classifyQuoteFailure, shortLuluReason, needsTeamAlert } from "../lib/lulu-quote-failure";
import { printSubmissionDecision, savedPaymentMode } from "../lib/print-submission-guard";
import { dialCodeForCountry, dialCodeOptions, prefixAfterCountryChange, prefixAfterManualChoice } from "../lib/phone-prefix";
import { orderTotalWithShipping } from "../lib/shipping-quote";
import { summarizeTotals, bucketFor, type LuluOrderInput } from "../lib/lulu-report";
import { parseLuluCostCalculation } from "../lib/print-costs";

test("shortLuluReason reads Lulu's detail/message/errors and shortens long text", () => {
  assert.equal(shortLuluReason('{"detail":"postcode is invalid"}'), "postcode is invalid");
  assert.equal(shortLuluReason('{"errors":{"shipping_address":["phone_number is required"]}}'), "shipping_address: phone_number is required");
  assert.equal(shortLuluReason(""), "");
  assert.ok(shortLuluReason("x".repeat(500)).length <= 160);
  assert.equal(shortLuluReason("<b>Bad gateway</b>"), "Bad gateway");
});

test("classifyQuoteFailure: each kind, its message and whether asking again can help", () => {
  const net = classifyQuoteFailure({ network: "Lulu did not answer in time" });
  assert.equal(net.kind, "unavailable"); assert.equal(net.retryable, true); assert.match(net.customerMessage, /Nothing has been charged/);
  assert.equal(classifyQuoteFailure({ status: 503 }).kind, "unavailable");
  assert.equal(classifyQuoteFailure({ status: 429 }).retryable, true);
  assert.equal(classifyQuoteFailure({ status: 401 }).kind, "auth");
  const addr = classifyQuoteFailure({ status: 400, body: '{"detail":"Invalid postcode for country"}' });
  assert.equal(addr.kind, "address"); assert.match(addr.customerMessage, /Invalid postcode/); assert.equal(addr.retryable, false);
  assert.equal(classifyQuoteFailure({ status: 422, body: '{"detail":"pod_package_id not available"}' }).kind, "rejected");
  assert.equal(classifyQuoteFailure({ pagesMissing: true }).kind, "pages");
  assert.equal(classifyQuoteFailure({ notConfigured: true }).kind, "not-configured");
  assert.equal(classifyQuoteFailure({ status: 200, unreadable: true }).kind, "unreadable");
  assert.equal(needsTeamAlert("auth"), true);
  assert.equal(needsTeamAlert("unavailable"), false);
  assert.equal(needsTeamAlert("address"), false);
});

const base = { luluEnvironment: "production" as const, gateway: "PAYSTACK" as const, paymentMode: "live" as const, currentPaystackMode: "live" as const, currentPaypalMode: "live" as const, isTestData: false };
test("print submission guard: live Lulu needs a confirmed, live-money, non-test payment", () => {
  assert.equal(printSubmissionDecision(base).allow, true);
  const noPay = printSubmissionDecision({ ...base, gateway: null });
  assert.equal(noPay.allow, false);
  const testPay = printSubmissionDecision({ ...base, paymentMode: "test" });
  assert.equal(testPay.allow, false); if (!testPay.allow) assert.equal(testPay.code, "test-payment");
  const paypalSandbox = printSubmissionDecision({ ...base, gateway: "PAYPAL", paymentMode: null, currentPaypalMode: "test" });
  assert.equal(paypalSandbox.allow, false);
  const testData = printSubmissionDecision({ ...base, isTestData: true });
  assert.equal(testData.allow, false); if (!testData.allow) assert.equal(testData.code, "test-data");
  // A saved "test" mode wins even if the gateway has since gone live (a sandbox order is never sent later).
  assert.equal(printSubmissionDecision({ ...base, paymentMode: "test", currentPaystackMode: "live" }).allow, false);
});
test("print submission guard: the Lulu sandbox is never held", () => {
  assert.equal(printSubmissionDecision({ ...base, luluEnvironment: "sandbox", gateway: null, paymentMode: "test", isTestData: true }).allow, true);
});
test("savedPaymentMode reads only test/live", () => {
  assert.equal(savedPaymentMode({ siteGatewayMode: "test" }), "test");
  assert.equal(savedPaymentMode({ siteGatewayMode: "live" }), "live");
  assert.equal(savedPaymentMode({ siteGatewayMode: "x" }), null);
  assert.equal(savedPaymentMode(null), null);
});

test("phone prefix follows the country, keeps manual choices, and lists codes only once", () => {
  assert.equal(dialCodeForCountry("Kenya"), "+254");
  assert.equal(dialCodeForCountry("United States"), "+1");
  assert.equal(dialCodeForCountry("Nowhere"), null);
  const opts = dialCodeOptions();
  assert.equal(new Set(opts).size, opts.length);
  assert.ok(opts.includes("+254") && opts.includes("+1"));
  assert.ok(opts.every((o) => /^\+\d+$/.test(o)));
  let s = { prefix: "+1", manual: false };
  s = prefixAfterCountryChange(s, "Kenya"); assert.deepEqual(s, { prefix: "+254", manual: false });
  s = prefixAfterCountryChange(s, "United Kingdom"); assert.equal(s.prefix, "+44");
  s = prefixAfterManualChoice("+91"); assert.deepEqual(s, { prefix: "+91", manual: true });
  assert.deepEqual(prefixAfterCountryChange(s, "Kenya"), { prefix: "+91", manual: true });
  assert.deepEqual(prefixAfterCountryChange({ prefix: "+44", manual: false }, ""), { prefix: "+44", manual: false });
});

test("order total = books + shipping + fulfillment fee, to the cent", () => {
  assert.equal(orderTotalWithShipping(20, 3.9, 0.75), 24.65);
  assert.equal(orderTotalWithShipping(20, 3.9), 23.9);
});

const ord = (o: Partial<LuluOrderInput> = {}): LuluOrderInput => ({
  orderId: "a", createdAt: new Date(), printJobStatus: "SUBMITTED", luluStatus: null, luluShippedAt: null,
  shippingPaid: 5, fulfillmentPaid: 0.75, luluProduction: null, luluShipping: 5, luluFulfillment: 0.75, lines: [{ paidBooks: 20, printingCost: 6 }], ...o,
});
test("admin Lulu totals include the fulfillment fee on both sides and the grand difference matches", () => {
  const t = summarizeTotals([ord(), ord()]);
  assert.equal(t.paidFulfillment, 1.5); assert.equal(t.luluFulfillment, 1.5);
  assert.equal(t.fulfillmentDifference, 0); assert.equal(t.grandDifference, 0); assert.equal(t.totalDifference, 0);
  const t2 = summarizeTotals([ord({ fulfillmentPaid: 0 })]);
  assert.equal(t2.fulfillmentDifference, -0.75); assert.equal(t2.grandDifference, -0.75);
});
test("a held test order shows as not sent", () => {
  assert.equal(bucketFor("HELD_TEST", null), "NOT_SENT");
});
test("Lulu's cost reply gives the fulfillment fee once for the whole order", () => {
  const q = parseLuluCostCalculation({ line_item_costs: [{ total_cost_excl_tax: "5.00" }, { total_cost_excl_tax: "7.00" }], shipping_cost: { total_cost_excl_tax: "4.00" }, fulfillment_cost: { total_cost_excl_tax: "0.75" } }, 2);
  assert.equal(q?.fulfillmentCost, 0.75);
});
