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
