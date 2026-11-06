import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composeScene } from "../lib/mockup/scene";

const form = readFileSync(new URL("../app/account/books/new/PrintSubmissionForm.tsx", import.meta.url), "utf8");

describe("autofill from the eBook copies the cover, never the eBook file", () => {
  const fn = form.slice(form.indexOf("async function autofillFromEbook"), form.indexOf("// The interior PDF that arrived by autofill"));
  test("the eBook file is not imported", () => {
    assert.ok(!fn.includes("prefill.manuscriptFileId"));
    assert.ok(!fn.includes("setPrintReadyPdfFileId"));
    assert.match(fn, /eBook file is not copied/);
  });
  test("the cover still comes across", () => assert.match(fn, /setFrontCoverImageUrl\(prefill\.coverImageUrl\)/));
});

describe("while the check runs nothing says 'needs fixing'", () => {
  test("a result for older files is hidden and the check shows as checking", () => {
    assert.match(form, /const shownPreflight = preflight && preflightFor === currentKeys/);
    assert.match(form, /const checkingNow = /);
    assert.match(form, /checkingNow \? "CHECKING"/);
    assert.match(form, /We and Lulu are checking/);
  });
});

describe("mockup covers carry no ground shadows", () => {
  const placements = [] as never[];
  test("shadows:false draws none", () => {
    const svg = composeScene(placements, { width: 200, height: 200, shadows: false });
    assert.ok(!svg.includes("softShadow)") && !svg.includes("contactShadow)") && !svg.includes("<image"));
  });
});

describe("author side changes (batch 6A)", () => {
  const r = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  test("mockups: no ground shadow and no floor reflection", () => {
    const m = r("lib/mockup/render.ts");
    assert.match(m, /shadows: false/);
    assert.match(m, /reflection: false/);
  });
  test("tabs and buttons are named as asked", () => {
    const t = r("app/account/books/new/NewBookFormTabs.tsx");
    assert.match(t, /Publish eBook\/Audiobook/);
    assert.match(t, /Publish Print Book/);
    assert.match(r("app/account/books/new/PublishPanel.tsx"), /"Save Draft"/);
  });
  test("publishing goes to the confirmation page first", () => {
    assert.match(r("app/account/books/new/EbookSubmissionForm.tsx"), /books\/published\?kind=ebook/);
    assert.match(r("app/account/books/new/PrintSubmissionForm.tsx"), /books\/published\?kind=print/);
    assert.match(r("app/account/books/published/page.tsx"), /submitted for review for approval/);
  });
  test("My Books: 15 a page, the new columns, hover edit, no status or edit column", () => {
    const p = r("app/account/books/page.tsx");
    assert.match(p, /PAGE_SIZE = 15/);
    for (const h of ["Title", "Author", "Category", "Units Sold", "Royalty", "eBook", "Audiobook", "Paperback", "Hardcover"]) assert.ok(p.includes(`>${h}<ColHelp`), h);
    assert.ok(!p.includes(">Status<ColHelp") && !p.includes(">Edit<ColHelp"));
    assert.match(p, /Edit eBook\/Audiobook/);
    assert.match(p, /Edit Print Book/);
    assert.match(p, /r\.category/);
  });
  test("editing one edition opens only that edition", () => {
    assert.match(r("app/account/books/[id]/edit/page.tsx"), /editionParam === "print"/);
    assert.match(r("app/account/books/[id]/edit/EditBookTabs.tsx"), /only !== "print"/);
  });
});

describe("admin review (batch 6B)", () => {
  const r = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const page = r("app/admin/books/[id]/review/page.tsx");
  test("the review page has a section per edition with its own preview and decision", () => {
    assert.match(page, /"eBook \/ Audiobook"/);
    assert.match(page, /"Print Book"/);
    assert.match(page, /<audio controls/);
    assert.match(page, /<ReviewActions bookId=\{row\.id\}/);
    assert.match(page, /Print books are PDF only/);
    assert.match(page, /PDF, EPUB or MOBI/);
  });
  test("Book Management shows an alert for books waiting for review", () => {
    const m = r("app/admin/books/page.tsx");
    assert.match(m, /waiting for review/);
    assert.match(m, /Needs review:/);
  });
});
