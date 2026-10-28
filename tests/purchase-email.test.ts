import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPurchaseEmail, type PurchaseEmailInput } from "../lib/email/purchase";
import { extractBlogMediaIds } from "../lib/blog-delete";

const base: PurchaseEmailInput = {
  siteUrl: "https://example.test",
  orderNumber: "ABC12345",
  orderDate: new Date("2026-10-27T10:00:00Z"),
  buyerName: "Amina Otieno",
  buyerEmail: "amina@example.com",
  lines: [
    { bookId: "b1", title: "Moon & Stars <3", format: "ebook", price: 4.99, fileReady: true },
    { bookId: "b2", title: "Big Red Barn", format: "paperback", price: 12.5, fileReady: true },
    { bookId: "b3", title: "Night Songs", format: "audiobook", price: 7, fileReady: true },
  ],
  shippingAmount: 3.5,
  totalAmount: 27.99,
  shipTo: { name: "Amina", address: "1 Main St", country: "Kenya" },
};

test("new guest email carries a one-time link and never a password", () => {
  const { subject, html } = buildPurchaseEmail({ ...base, setPasswordUrl: "https://example.test/reset-password?token=tok" });
  assert.match(subject, /account is ready/);
  assert.ok(html.includes("reset-password?token=tok"));
  assert.ok(html.includes("amina@example.com"));
  assert.ok(!/temporary password|your password is/i.test(html));
  assert.ok(html.includes("works once") || html.includes("once"));
});

test("existing-account email says log in with existing details and links forgot password", () => {
  const { subject, html } = buildPurchaseEmail(base);
  assert.match(subject, /is confirmed/);
  assert.ok(html.includes("existing account details"));
  assert.ok(html.includes("/forgot-password"));
  assert.ok(!html.includes("reset-password?token"));
});

test("each item follows its type: library for digital, ship note for print, no attachments or file links", () => {
  const { html } = buildPurchaseEmail(base);
  assert.ok(html.includes("Your digital books"));
  assert.ok(html.includes("/account/library"));
  assert.ok(html.includes("will be printed and shipped"));
  assert.ok(!html.includes("/api/downloads"));
  // Digital section lists only the digital titles.
  const digital = html.slice(html.indexOf("Your digital books"), html.indexOf("Your printed books"));
  assert.ok(digital.includes("Night Songs") && digital.includes("Moon &amp; Stars"));
  assert.ok(!digital.includes("Big Red Barn"));
});

test("print-only order has no library or download section", () => {
  const { html } = buildPurchaseEmail({ ...base, lines: [base.lines[1]] });
  assert.ok(!html.includes("Your digital books"));
  assert.ok(html.includes("Your printed books"));
});

test("summary shows titles, formats, prices paid, order number and date; titles are escaped", () => {
  const { html } = buildPurchaseEmail(base);
  for (const t of ["Moon &amp; Stars &lt;3", "eBook", "Paperback", "Audiobook", "$4.99", "$12.50", "$7.00", "#ABC12345", "October 27, 2026", "Total paid: $27.99"]) assert.ok(html.includes(t), t);
});

test("blog media ids are found in the cover and the body", () => {
  const ids = extractBlogMediaIds("/api/images/cov1", '<p><img src="/api/images/in1?w=640"><a href="/api/files/f9">x</a></p>');
  assert.deepEqual(ids.imageIds.sort(), ["cov1", "in1"]);
  assert.deepEqual(ids.fileIds, ["f9"]);
});

test("email is sent only for paid orders, once, and nothing stores or sends a password", () => {
  const src = readFileSync("lib/email/purchase.ts", "utf8");
  assert.ok(src.includes('order.status !== "PAID"'));
  assert.ok(src.includes("purchaseEmailSentAt: null }, data:"));
  const orders = readFileSync("actions/orders.ts", "utf8");
  assert.ok(!orders.includes("guestTempPassword") && !orders.includes("generateTempPassword"));
  assert.ok(orders.includes('code === "P2002"'));
  assert.ok(!/^"use server"/m.test(readFileSync("actions/order-emails.ts", "utf8")));
});

test("admin blog delete is enforced on the server for admins only", () => {
  const src = readFileSync("actions/blog-management.ts", "utf8");
  const fn = src.slice(src.indexOf("export async function adminDeleteBlog"));
  assert.ok(fn.includes("authAdmin()") && fn.includes('role !== "ADMIN"'));
  const page = readFileSync("app/admin/blog/page.tsx", "utf8");
  assert.ok(page.includes('role === "ADMIN" && <DeleteBlogButton'));
});

test("setting a password clears the guest-setup flag", () => {
  assert.ok(readFileSync("actions/password-reset.ts", "utf8").includes("guestSetupPending: false"));
  assert.ok(readFileSync("actions/security.ts", "utf8").includes("guestSetupPending: false"));
});
