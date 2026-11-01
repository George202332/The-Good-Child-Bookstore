import test from "node:test";
import assert from "node:assert/strict";
import { shippingOutcome } from "../lib/shipping-options-state";
import { sealQuote, openQuote, quoteFingerprint, QUOTE_TOKEN_MINUTES } from "../lib/shipping-quote-token";
import { formatPostedFlags } from "../lib/book-format-views";

process.env.AUTH_SECRET = "test-secret-for-round-55";
const items = [{ bookId: "b1", qty: 1, format: "paperback" }];

test("shippingOutcome: ok, incomplete, cannot-ship, unavailable", () => {
  assert.equal(shippingOutcome({ lulu: "ok", offered: 2, countryName: "Kenya" }).state, "ok");
  assert.equal(shippingOutcome({ lulu: "incomplete", offered: 0, countryName: "" }).state, "incomplete");
  const none = shippingOutcome({ lulu: "none", offered: 0, countryName: "Kenya" });
  assert.equal(none.state, "cannot-ship");
  assert.match(none.message!, /cannot ship this printed book to Kenya/);
  assert.equal(shippingOutcome({ lulu: "ok", offered: 0, countryName: "Kenya" }).state, "cannot-ship");
  const err = shippingOutcome({ lulu: "error", offered: 0, countryName: "Kenya" });
  assert.equal(err.state, "unavailable");
  assert.match(err.message!, /nothing has been charged/);
});

test("fingerprint follows items, country and address (spacing/case ignored)", () => {
  const a = quoteFingerprint({ items, countryIso: "KE", address: "1 Road\nNairobi" });
  assert.equal(a, quoteFingerprint({ items, countryIso: "ke", address: "1  road nairobi" }));
  assert.notEqual(a, quoteFingerprint({ items, countryIso: "KE", address: "1 Road\nMombasa" }));
  assert.notEqual(a, quoteFingerprint({ items, countryIso: "US", address: "1 Road\nNairobi" }));
  assert.notEqual(a, quoteFingerprint({ items: [{ ...items[0], qty: 2 }], countryIso: "KE", address: "1 Road\nNairobi" }));
});

test("sealed quote: opens for the same level+fingerprint, rejects others, expiry and tampering", () => {
  const fp = quoteFingerprint({ items, countryIso: "KE", address: "x" });
  const now = Date.now();
  const t = sealQuote({ level: "MAIL", amount: 12.5, fp }, now);
  assert.equal(openQuote(t, { level: "MAIL", fp }, now)?.amount, 12.5);
  assert.equal(openQuote(t, { level: "PRIORITY_MAIL", fp }, now), null);
  assert.equal(openQuote(t, { level: "MAIL", fp: "other" }, now), null);
  assert.equal(openQuote(t, { level: "MAIL", fp }, now + (QUOTE_TOKEN_MINUTES + 1) * 60000), null);
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), amount: 0.01 })).toString("base64url");
  assert.equal(openQuote(`${forged}.${sig}`, { level: "MAIL", fp }, now), null);
  assert.equal(openQuote(null, { level: "MAIL", fp }, now), null);
  assert.ok(!t.includes("test-secret"));
});

test("formatPostedFlags: only published formats are ticked", () => {
  const f = formatPostedFlags([
    { key: "ebook", status: "PUBLISHED" }, { key: "print", status: "DRAFT" }, { key: "audiobook", status: "PUBLISHED" },
  ]);
  assert.deepEqual(f, { ebook: true, audiobook: true, print: false });
  assert.deepEqual(formatPostedFlags([]), { ebook: false, audiobook: false, print: false });
});
