import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { needsReReview, fileRefKey } from "../lib/revision-trigger";

describe("needsReReview", () => {
  test("no change", () => {
    const r = needsReReview({ currentManuscriptRef: "m1", newManuscriptRef: "m1", currentCoverRef: "/c1.png", newCoverRef: "/c1.png" });
    assert.deepEqual(r, { manuscript: false, cover: false, required: false });
  });
  test("same file resubmitted in a different form", () => {
    const r = needsReReview({ currentManuscriptRef: "/api/files/m1", newManuscriptRef: "m1", currentCoverRef: " /c1.png ", newCoverRef: "/c1.png" });
    assert.equal(r.required, false);
    assert.equal(needsReReview({ currentManuscriptRef: "/api/files/m1?v=2", newManuscriptRef: "/api/files/m1" }).required, false);
  });
  test("new manuscript", () => {
    const r = needsReReview({ currentManuscriptRef: "/api/files/m1", newManuscriptRef: "m2", currentCoverRef: "/c1.png", newCoverRef: "/c1.png" });
    assert.deepEqual(r, { manuscript: true, cover: false, required: true });
  });
  test("new cover", () => {
    const r = needsReReview({ currentManuscriptRef: "m1", newManuscriptRef: "m1", currentCoverRef: "/c1.png", newCoverRef: "/c2.png" });
    assert.deepEqual(r, { manuscript: false, cover: true, required: true });
  });
  test("both", () => {
    const r = needsReReview({ currentManuscriptRef: "m1", newManuscriptRef: "m2", currentCoverRef: "/c1.png", newCoverRef: "/c2.png" });
    assert.deepEqual(r, { manuscript: true, cover: true, required: true });
  });
  test("null current with a new file is an upload", () => {
    const r = needsReReview({ currentManuscriptRef: null, newManuscriptRef: "m1", currentCoverRef: undefined, newCoverRef: "/c1.png" });
    assert.deepEqual(r, { manuscript: true, cover: true, required: true });
  });
  test("null or empty new file is not a replacement", () => {
    const r = needsReReview({ currentManuscriptRef: "m1", newManuscriptRef: null, currentCoverRef: "/c1.png", newCoverRef: "  " });
    assert.deepEqual(r, { manuscript: false, cover: false, required: false });
  });
  test("both null", () => {
    assert.deepEqual(needsReReview({}), { manuscript: false, cover: false, required: false });
    assert.deepEqual(needsReReview({ currentManuscriptRef: null, newManuscriptRef: null, currentCoverRef: null, newCoverRef: null }).required, false);
  });
  test("fileRefKey", () => {
    assert.equal(fileRefKey(undefined), null);
    assert.equal(fileRefKey("   "), null);
    assert.equal(fileRefKey("/api/files/abc"), "abc");
    assert.equal(fileRefKey("https://x.test/a.png"), "https://x.test/a.png");
  });
  test("first manuscript on an audiobook-only title (no current manuscript) counts as a manuscript upload", () => {
    const r = needsReReview({ currentManuscriptRef: undefined, newManuscriptRef: "m1", currentCoverRef: "/c1.png", newCoverRef: "/c1.png" });
    assert.deepEqual(r, { manuscript: true, cover: false, required: true });
  });
  test("audiobook-only title edited without any manuscript needs no review", () => {
    const r = needsReReview({ currentManuscriptRef: undefined, newManuscriptRef: undefined, currentCoverRef: "/c1.png", newCoverRef: "/c1.png" });
    assert.deepEqual(r, { manuscript: false, cover: false, required: false });
  });
});
