import test from "node:test";
import assert from "node:assert/strict";
import { identifierFor, snColumn, isbnColumn } from "../lib/identifiers";
import { formatTabsOf, groupIdentifierColumns, missingFormatsOf, type FormatViewRow } from "../lib/book-format-views";

const base = { isbn: null, hasEbook: false, hasAudiobook: false, hasPrint: false };

test("eBook and audiobook share one SN number", () => {
  const src = { ...base, isbn: "SN-000123", hasEbook: true, hasAudiobook: true };
  assert.deepEqual(identifierFor(src, "ebook"), { label: "SN number", value: "SN-000123" });
  assert.deepEqual(identifierFor(src, "audiobook"), { label: "SN number", value: "SN-000123" });
});

test("an author's own ISBN replaces the SN number and is labelled ISBN", () => {
  const src = { ...base, isbn: "9780306406157", hasEbook: true };
  assert.deepEqual(identifierFor(src, "ebook"), { label: "ISBN", value: "9780306406157" });
});

test("print ISBNs are per format and never shared implicitly", () => {
  const src = { ...base, hasPrint: true, printIsbns: { paperback: "9780306406157" } };
  assert.equal(identifierFor(src, "paperback").value, "9780306406157");
  assert.equal(identifierFor(src, "hardcover").value, null);
  assert.equal(isbnColumn(src), "9780306406157");
});

test("admin columns show a dash (null) where not applicable", () => {
  assert.equal(isbnColumn({ ...base, isbn: "SN-1", hasEbook: true }), null);
  assert.equal(snColumn({ ...base, hasPrint: true, printIsbns: {} }), null);
});

test("tabs and columns for a group of separate records", () => {
  const e: FormatViewRow = { id: "e", status: "PUBLISHED", isbn: "SN-1", hasEbook: true, hasPrint: false, hasAudiobook: false, ebookPrice: 4.5, paperbackPrice: null, hardcoverPrice: null, audiobookPrice: null, submissionMetadata: null };
  const p: FormatViewRow = { id: "p", status: "PENDING_REVIEW", isbn: null, hasEbook: false, hasPrint: true, hasAudiobook: false, ebookPrice: null, paperbackPrice: 12, hardcoverPrice: null, audiobookPrice: null, submissionMetadata: { printPreflight: { status: "FAILED", checkedAt: "2026-10-01T00:00:00Z", reasons: ["Fonts are not embedded"] } } };
  const tabs = formatTabsOf([e, p]);
  assert.deepEqual(tabs.map((t) => t.key), ["ebook", "print"]);
  assert.equal(tabs[0].details[0].value, "$4.50");
  assert.equal(tabs[1].preflight?.status, "FAILED");
  assert.deepEqual(missingFormatsOf([e, p]), ["audiobook"]);
  assert.deepEqual(groupIdentifierColumns([e, p]), { sn: "SN-1", isbn: null });
});
