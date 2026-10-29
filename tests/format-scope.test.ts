import test from "node:test";
import assert from "node:assert/strict";
import { mergeFormatFields, mergeMetadata, scopeOf, type FormatFields } from "../lib/format-scope";

const stored: FormatFields = { hasEbook: true, ebookPrice: 4.99, hasAudiobook: true, audiobookPrice: 7, hasPrint: true, paperbackPrice: 12, hardcoverPrice: 20 };
const printForm: FormatFields = { hasEbook: false, ebookPrice: null, hasAudiobook: false, audiobookPrice: null, hasPrint: true, paperbackPrice: 13, hardcoverPrice: null };
const ebookForm: FormatFields = { hasEbook: true, ebookPrice: 5.5, hasAudiobook: false, audiobookPrice: null, hasPrint: false, paperbackPrice: null, hardcoverPrice: null };

test("saving the Print form never changes the eBook or audiobook", () => {
  const r = mergeFormatFields(scopeOf({ print: true }), stored, printForm);
  assert.equal(r.hasEbook, true);
  assert.equal(r.ebookPrice, 4.99);
  assert.equal(r.hasAudiobook, true);
  assert.equal(r.audiobookPrice, 7);
  assert.equal(r.paperbackPrice, 13);
  assert.equal(r.hardcoverPrice, null); // the Print form's own choice
});

test("saving the eBook form never changes print", () => {
  const r = mergeFormatFields(scopeOf({ print: false }), stored, ebookForm);
  assert.equal(r.hasPrint, true);
  assert.equal(r.paperbackPrice, 12);
  assert.equal(r.hardcoverPrice, 20);
  assert.equal(r.ebookPrice, 5.5);
  assert.equal(r.hasAudiobook, false); // the eBook/Audiobook form's own choice
});

test("an eBook-only book gains print without losing its eBook price", () => {
  const ebookOnly: FormatFields = { hasEbook: true, ebookPrice: 3, hasAudiobook: false, audiobookPrice: null, hasPrint: false, paperbackPrice: null, hardcoverPrice: null };
  const r = mergeFormatFields("print", ebookOnly, printForm);
  assert.equal(r.hasEbook, true);
  assert.equal(r.ebookPrice, 3);
  assert.equal(r.hasPrint, true);
});

test("metadata of the other format is kept; the form's own keys are taken from the form", () => {
  const existing = { trimSizeCode: "0600X0900", paperbackRetailPrice: 12, fileSizeKB: 900, narrator: "Ann", title: "old" };
  const printSave = mergeMetadata("print", existing, { trimSizeCode: "0550X0850", fileSizeKB: undefined, pages: 40 });
  assert.equal(printSave.fileSizeKB, 900);
  assert.equal(printSave.narrator, "Ann");
  assert.equal(printSave.trimSizeCode, "0550X0850");
  const ebookSave = mergeMetadata("digital", existing, { trimSizeCode: undefined, fileSizeKB: 800 });
  assert.equal(ebookSave.trimSizeCode, "0600X0900");
  assert.equal(ebookSave.paperbackRetailPrice, 12);
  assert.equal(ebookSave.fileSizeKB, 800);
});
