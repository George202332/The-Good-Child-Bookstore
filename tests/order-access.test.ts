import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPurchaseEmail, type PurchaseEmailInput } from "../lib/email/purchase";
import { orderAccessToken, verifyOrderAccessToken, receiptUrl, confirmationUrl, newLoginToken, hashLoginToken } from "../lib/order-access";

process.env.AUTH_SECRET = "test-secret-for-unit-tests";

test("receipt token is order-specific and verifies only for its own order", () => {
  const t = orderAccessToken("order-1");
  assert.ok(t.length >= 40);
  assert.ok(verifyOrderAccessToken("order-1", t));
  assert.ok(!verifyOrderAccessToken("order-2", t));
  assert.ok(!verifyOrderAccessToken("order-1", t + "x"));
  assert.ok(!verifyOrderAccessToken("order-1", ""));
  assert.ok(!verifyOrderAccessToken("order-1", null));
  assert.ok(receiptUrl("order-1").includes(`t=${t}`));
  assert.ok(confirmationUrl("order-1").includes(`k=${t}`));
});

test("with no secret configured, tokens fail closed", () => {
  const a = process.env.AUTH_SECRET;
  const b = process.env.SETTINGS_ENCRYPTION_KEY;
  delete process.env.AUTH_SECRET;
  delete process.env.SETTINGS_ENCRYPTION_KEY;
  assert.equal(orderAccessToken("order-1"), "");
  assert.ok(!verifyOrderAccessToken("order-1", ""));
  assert.ok(!verifyOrderAccessToken("order-1", "anything"));
  process.env.AUTH_SECRET = a;
  if (b) process.env.SETTINGS_ENCRYPTION_KEY = b;
});

test("one-time sign-in tokens are random and stored only as a hash", () => {
  const a = newLoginToken();
  const b = newLoginToken();
  assert.notEqual(a.token, b.token);
  assert.equal(hashLoginToken(a.token), a.hash);
  assert.notEqual(a.hash, a.token);
});

test("receipt route: token or owner, attachment, paid-only, no sign-in page", () => {
  const src = readFileSync("app/api/receipts/[orderId]/route.ts", "utf8");
  assert.ok(src.includes("verifyOrderAccessToken"));
  assert.ok(src.includes("attachment;"));
  assert.ok(!src.includes("Sign in required"));
  assert.ok(src.includes('order.status !== "PAID"'));
});

test("confirmation page: receipt link downloads in place and only after the paid check", () => {
  const src = readFileSync("app/checkout/confirmation/page.tsx", "utf8");
  assert.ok(!src.includes('target="_blank"'));
  assert.ok(src.includes("receiptUrl("));
  assert.ok(src.indexOf('!== "PAID"') < src.indexOf("receiptUrl("));
});

test("return page only hands out the secret key on verified paths", () => {
  const src = readFileSync("app/checkout/return/page.tsx", "utf8");
  assert.ok(src.includes("successUrl("));
  // The only direct confirmationUrl uses are the verified ones (helper, Paystack ok, pending ref, PayPal verdict).
  assert.equal((src.match(/redirect\(confirmationUrl\(/g) ?? []).length, 2);
});

test("order-link sign-in refuses accounts that already have their own password", () => {
  const src = readFileSync("lib/auth.ts", "utf8");
  assert.ok(src.includes("guestSetupPending"));
  assert.ok(src.includes('id: "order-link"'));
});

const base: PurchaseEmailInput = {
  siteUrl: "https://example.test",
  orderNumber: "ABC12345",
  orderDate: new Date("2026-10-27T10:00:00Z"),
  buyerName: "Amina Otieno",
  buyerEmail: "amina@example.com",
  lines: [{ bookId: "b1", title: "Moon", format: "ebook", price: 4.99, fileReady: true }],
  shippingAmount: 0,
  totalAmount: 4.99,
};

test("new-guest email includes the one-time Go to my account link, no password", () => {
  const { html } = buildPurchaseEmail({ ...base, setPasswordUrl: "https://example.test/reset-password?token=a", signInUrl: "https://example.test/welcome?token=b" });
  assert.ok(html.includes("welcome?token=b"));
  assert.ok(html.includes("Go to my account"));
  assert.ok(html.includes("reset-password?token=a"));
  assert.ok(!/your password is|temporary password/i.test(html));
  const existing = buildPurchaseEmail(base).html;
  assert.ok(!existing.includes("welcome?token"));
});
