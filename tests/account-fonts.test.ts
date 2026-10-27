import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACCOUNT_FONTS, ACCOUNT_FONT_SIZES, normalizeAppearance, fontStack } from "../lib/account-fonts";

test("font list has 10 to 15 curated options including Default", () => {
  assert.ok(ACCOUNT_FONTS.length >= 10 && ACCOUNT_FONTS.length <= 15);
  assert.equal(ACCOUNT_FONTS[0].key, "default");
  assert.equal(ACCOUNT_FONTS[0].stack, null);
  assert.equal(new Set(ACCOUNT_FONTS.map((f) => f.key)).size, ACCOUNT_FONTS.length);
});

test("sizes are Small / Default / Large / Extra Large", () => {
  assert.deepEqual(ACCOUNT_FONT_SIZES.map((s) => s.label), ["Small", "Default", "Large", "Extra Large"]);
  assert.equal(ACCOUNT_FONT_SIZES.find((s) => s.key === "default")!.zoom, 1);
});

test("unknown or tampered values fall back to default", () => {
  assert.deepEqual(normalizeAppearance({ fontFamily: "<script>", fontSize: 99 }), { fontFamily: "default", fontSize: "default" });
  assert.deepEqual(normalizeAppearance(null), { fontFamily: "default", fontSize: "default" });
  assert.deepEqual(normalizeAppearance({ fontFamily: "lexend", fontSize: "xlarge" }), { fontFamily: "lexend", fontSize: "xlarge" });
  assert.equal(fontStack("default"), null);
});

test("every listed font is loaded by the account font faces file", () => {
  const faces = readFileSync("components/AccountFontFaces.ts", "utf8");
  const pkgs = ["atkinson-hyperlegible", "lexend", "opendyslexic", "open-sans", "roboto", "lato", "nunito", "source-sans-3", "inter", "pt-sans", "merriweather", "lora", "noto-serif"];
  for (const p of pkgs) assert.ok(faces.includes(`@fontsource/${p}/latin-400.css`), p);
});

test("fonts are loaded only by account/backend layouts, never the root layout", () => {
  const root = readFileSync("app/layout.tsx", "utf8");
  assert.ok(!root.includes("AccountFont") && !root.includes("fontsource"));
  assert.ok(readFileSync("app/account/layout.tsx", "utf8").includes("AccountFontScope"));
  assert.ok(readFileSync("app/admin/layout.tsx", "utf8").includes("AccountFontScope"));
});

test("promotions are cleaned up whenever a book is removed", () => {
  for (const f of ["actions/admin.ts", "actions/submissions.ts", "actions/book-management.ts"]) {
    assert.ok(readFileSync(f, "utf8").includes("removeBookPromotions"), f);
  }
});

test("My Blogs writes use the account session, not the staff session", () => {
  const s = readFileSync("actions/blog.ts", "utf8");
  const save = s.slice(s.indexOf("export async function saveBlogPost"), s.indexOf("export async function updateBlogPost"));
  assert.ok(save.includes("accountAuth()") && !save.includes("authEither()"));
});
