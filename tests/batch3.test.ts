import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { timesWidth } from "../lib/times-widths";
import { BACK_TEXT_SIZE_PT, BACK_TEXT_MIN_PT } from "../lib/back-cover";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the on-screen preview measures text with Times widths that match the Tinos font the print file embeds", async () => {
  const fontkit = (await import("@pdf-lib/fontkit")).default as unknown as { create(b: Uint8Array): { unitsPerEm: number; layout(t: string): { positions: { xAdvance: number }[] } } };
  for (const [file, bold] of [["Tinos_400Regular.ttf", false], ["Tinos_700Bold.ttf", true]] as const) {
    const f = fontkit.create(new Uint8Array(readFileSync(new URL(`../lib/pdf-fonts/${file}`, import.meta.url))));
    for (const text of ["The Friend Who Came For Tea", "A story about a friend who came for tea, and stayed.", "Liam Walker", "WAVE! (1,234) 'quoted' @home #1"]) {
      const real = f.layout(text).positions.reduce((s, p) => s + p.xAdvance, 0) * (100 / f.unitsPerEm);
      const approx = timesWidth(text, 100, bold);
      assert.ok(Math.abs(real - approx) / real < 0.03, `${file} "${text}": real ${real}, table ${approx}`);
    }
  }
});

test("back cover and spine fonts: Tinos everywhere (print file, preview, 3D mockups); front cover untouched", () => {
  for (const p of ["lib/lulu-cover.ts", "lib/mockup/render.ts", "lib/mockup/wrap.ts"]) {
    const s = src(p);
    assert.doesNotMatch(s, /Arimo_(400Regular|700Bold)\.ttf/, p);
    assert.match(s, /Tinos_(400Regular|700Bold)\.ttf/, p);
  }
  const preview = src("components/CoverWrapPreview.tsx");
  assert.match(preview, /Times New Roman/);
  assert.doesNotMatch(preview, /Arial, Helvetica/);
  assert.equal(BACK_TEXT_SIZE_PT, 11);
  assert.equal(BACK_TEXT_MIN_PT, 10);
  assert.doesNotMatch(src("lib/back-cover.ts"), /10% larger|0\.1265/);
});

test("My Books table: 15 per page with arrows, no action column, prices in brackets, status pills", () => {
  const t = src("app/account/books/MyBooksTable.tsx");
  assert.match(t, /const PAGE_SIZE = 15;/);
  assert.doesNotMatch(t, /Load More/);
  assert.match(t, /Showing \{first\} to \{last\} of \{rows\.length\}/);
  assert.match(t, /Previous/);
  assert.match(t, /Next →/);
  assert.doesNotMatch(t, /aria-label="Actions"/);
  assert.match(t, /\(\$\{cell\.price\.toFixed\(2\)\}\)/);
  for (const pill of ["Published", "On Review", "Unpublished"]) assert.match(t, new RegExp(`"${pill}"`));
  assert.match(t, /\.mybooks-card\{border-radius:14px/);
  assert.match(t, /borderRadius: 0/, "cover thumbnails have sharp square corners");
  assert.doesNotMatch(t, /borderRadius: 3/);
  assert.match(t, /height: 58/, "thumbnails are about 20% taller (48 to 58)");
  assert.doesNotMatch(t, /overflow-x:auto/, "no scroll bar of its own");
});

test("print upload cards: all three have the hover Upload / drag and drop options; Front Cover Only has no separate Replace Image button", () => {
  const form = src("app/account/books/new/PrintSubmissionForm.tsx");
  assert.equal((form.match(/hoverOptions/g) ?? []).length, 3);
  assert.match(form, /showReplaceButton=\{false\}/);
  const img = src("components/ImageUploadField.tsx");
  assert.match(img, /hasFile && showReplaceButton/);
  const css = src("app/site.css");
  assert.match(css, /@media \(hover:hover\) and \(pointer:fine\)\{\s*\.upload-card\.with-hover:hover \.upload-card-hover\{display:flex;\}/);
  assert.match(css, /\.upload-card\.with-hover\{[^}]*min-height:190px/);
});
