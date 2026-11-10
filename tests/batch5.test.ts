import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placeholderStyle, responsiveImage } from "../lib/image-url";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("side spacing: one shared fluid gutter on .wrap that page padding cannot wipe out", () => {
  const css = src("app/site.css");
  assert.match(css, /--gutter:clamp\(16px, 5vw, 40px\)/);
  assert.match(css, /\.wrap\{[^}]*padding-left:max\(var\(--gutter\), env\(safe-area-inset-left\)\) !important/);
  assert.match(css, /padding-right:max\(var\(--gutter\), env\(safe-area-inset-right\)\) !important/);
  assert.match(css, /html,body\{max-width:100%;overflow-x:clip/);
  assert.match(src("components/AnalyticsConsent.tsx"), /env\(safe-area-inset-left\)/);
});

test("covers: sized copies, a placeholder at once, first covers eager", () => {
  const r = responsiveImage("/api/images/abc", [240, 480, 640]);
  assert.match(r.srcSet ?? "", /abc\?w=240 240w/);
  assert.match(placeholderStyle("/api/images/abc").backgroundImage ?? "", /\?w=24/);
  assert.deepEqual(placeholderStyle("https://x.test/a.jpg"), {});
  const card = src("components/BookCard.tsx");
  assert.match(card, /priority \? "eager" : "lazy"/);
  assert.match(card, /fetchPriority=\{priority \? "high" : "auto"\}/);
  assert.match(src("components/ShopPageClient.tsx"), /priority=\{i < 6\}/);
});

test("image route: the CDN keeps each size for a year (database read and resize happen once)", () => {
  const route = src("app/api/images/[id]/route.ts");
  assert.match(route, /s-maxage=31536000/);
});

test("product page: both print mockups are preloaded when the page opens, in the size the screen uses", () => {
  const p = src("app/book/[id]/BookDetailClient.tsx");
  assert.match(p, /preload\(r\.src, \{ as: "image", imageSrcSet: r\.srcSet/);
  assert.match(p, /fetchPriority="high"/);
});

test("public book data: remembered for a minute and refreshed the moment a book is published or edited", () => {
  const store = src("lib/mockup/store.ts");
  assert.match(store, /unstable_cache\(\(\) => readPrintMockupUrls/);
  assert.match(store, /revalidateTag\("books"/);
  assert.doesNotMatch(src("actions/admin.ts"), /revalidateTag/, "admin back end untouched");
});
