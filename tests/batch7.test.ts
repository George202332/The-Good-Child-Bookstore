import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { STAGING_EMAIL_ADDRESS } from "../lib/runtime-env";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Needs action lives in Book Management, not on the dashboard", () => {
  assert.doesNotMatch(read("app/admin/page.tsx"), /Needs action|listNeedsAction/);
  assert.match(read("app/admin/books/page.tsx"), /<NeedsActionBanner \/>/);
  const banner = read("components/NeedsActionBanner.tsx");
  assert.match(banner, /#1F1300/); assert.match(banner, /Open Review/);
});

test("Personal Message code is gone", () => {
  for (const f of ["lib/personal-message.ts", "lib/personal-message-db.ts", "actions/personal-message.ts", "components/PersonalMessagePanel.tsx", "app/admin/personal-messages/page.tsx"]) assert.equal(existsSync(new URL(`../${f}`, import.meta.url)), false, f);
  for (const f of ["app/book/[id]/BookDetailClient.tsx", "app/checkout/CheckoutClient.tsx", "hooks/useCart.ts", "components/AdminShell.tsx", "app/admin/page.tsx", "lib/payments/lulu.ts", "actions/orders.ts"]) assert.doesNotMatch(read(f), /personal-message|PersonalMessage|personalMessage/i, f);
});

test("footer payment strip: PayPal, Mastercard, Visa, American Express, Verve", () => {
  const f = read("components/Footer.tsx");
  const order = ["paypal", "mastercard", "visa", "amex", "verve"].map((k) => f.indexOf(`{ key: "${k}"`));
  assert.ok(order.every((n) => n > 0) && [...order].sort((a, b) => a - b).join() === order.join());
  assert.match(f, /key === "verve" && !badges\.verve/);
});

test("the staging mailbox is the new address, and the old one is gone", () => {
  assert.equal(STAGING_EMAIL_ADDRESS, "thegoodchildbookstore@gmail.com");
});

test("the Authors tab lists only this account's names", () => {
  assert.match(read("app/account/authors/page.tsx"), /filter\(\(r\) => r\.authorId === mine\.id\)/);
});

test("mobile dashboards: cards and charts can shrink inside the margins", () => {
  const css = read("app/site.css");
  assert.match(css, /\.dash-grid-main, \.dash-grid-perf, \.dash-grid-2, \.dash-grid-2-tight\{grid-template-columns:minmax\(0,1fr\);\}/);
  assert.match(css, /\.bar-chart\{display:flex/);
  assert.match(read("components/charts/BarChart.tsx"), /className="bar-chart"/);
});
