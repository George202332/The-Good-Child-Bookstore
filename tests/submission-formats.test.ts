import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveFormats, NO_FILES_ERROR, EBOOK_PRICE_ERROR, AUDIOBOOK_PRICE_ERROR } from "../lib/submission-formats";

describe("resolveFormats", () => {
  test("eBook only", () => {
    const r = resolveFormats({ manuscriptFileId: "m1", ebookPrice: 12.99 });
    assert.deepEqual(r, { hasEbook: true, hasAudiobook: false, ebookPrice: 12.99, audiobookPrice: null, basePrice: 12.99, errors: [] });
  });
  test("eBook only ignores a stray audiobook price", () => {
    const r = resolveFormats({ manuscriptFileId: "m1", ebookPrice: "9.5", audiobookPrice: 20 });
    assert.equal(r.hasAudiobook, false);
    assert.equal(r.audiobookPrice, null);
    assert.equal(r.ebookPrice, 9.5);
    assert.deepEqual(r.errors, []);
  });
  test("audiobook only needs no eBook price and uses the audiobook price as the base price", () => {
    const r = resolveFormats({ audiobookFileId: "a1", ebookPrice: 0, audiobookPrice: 15 });
    assert.deepEqual(r, { hasEbook: false, hasAudiobook: true, ebookPrice: null, audiobookPrice: 15, basePrice: 15, errors: [] });
  });
  test("audiobook only ignores a stray eBook price", () => {
    const r = resolveFormats({ audiobookFileId: "a1", ebookPrice: 12.99, audiobookPrice: 15 });
    assert.equal(r.ebookPrice, null);
    assert.equal(r.basePrice, 15);
  });
  test("both: base price is the eBook price", () => {
    const r = resolveFormats({ manuscriptFileId: "m1", audiobookFileId: "a1", ebookPrice: 8, audiobookPrice: 15 });
    assert.deepEqual(r, { hasEbook: true, hasAudiobook: true, ebookPrice: 8, audiobookPrice: 15, basePrice: 8, errors: [] });
  });
  test("neither file is an error", () => {
    const r = resolveFormats({ ebookPrice: 10, audiobookPrice: 10 });
    assert.deepEqual(r.errors, [NO_FILES_ERROR]);
    assert.equal(r.basePrice, null);
    assert.equal(resolveFormats({ manuscriptFileId: "", audiobookFileId: null }).errors[0], NO_FILES_ERROR);
  });
  test("neither file is allowed when requireFile is false (print titles)", () => {
    assert.deepEqual(resolveFormats({ requireFile: false }).errors, []);
  });
  test("manuscript without a valid price", () => {
    for (const p of [undefined, null, "", 0, -1, "abc", NaN]) {
      assert.deepEqual(resolveFormats({ manuscriptFileId: "m1", ebookPrice: p as number }).errors, [EBOOK_PRICE_ERROR]);
    }
  });
  test("audiobook without a valid price", () => {
    for (const p of [undefined, null, "", 0, -3]) {
      assert.deepEqual(resolveFormats({ audiobookFileId: "a1", audiobookPrice: p as number }).errors, [AUDIOBOOK_PRICE_ERROR]);
    }
  });
  test("both files, both prices missing", () => {
    const r = resolveFormats({ manuscriptFileId: "m1", audiobookFileId: "a1" });
    assert.deepEqual(r.errors, [EBOOK_PRICE_ERROR, AUDIOBOOK_PRICE_ERROR]);
  });
});
