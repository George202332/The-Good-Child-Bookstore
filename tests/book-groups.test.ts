import test from "node:test";
import assert from "node:assert/strict";
import { groupEditions, splitTitles, titleKey, type EditionRow } from "../lib/book-groups";

let n = 0;
const row = (over: Partial<EditionRow>): EditionRow => ({
  id: `b${++n}`, authorId: "a1", title: "The Moon Book", createdAt: new Date(2026, 0, n), hasEbook: false, hasPrint: false, hasAudiobook: false, ...over,
});

test("an eBook record and a print record of the same title become one book", () => {
  const ebook = row({ hasEbook: true });
  const print = row({ hasPrint: true, title: "  the moon  BOOK " });
  const groups = groupEditions([print, ebook]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0][0].id, ebook.id); // the eBook record leads
  assert.equal(groups[0].length, 2);
});

test("eBook + audiobook + print records of one title are one book with three editions", () => {
  const rows = [row({ hasEbook: true }), row({ hasAudiobook: true }), row({ hasPrint: true })];
  assert.equal(groupEditions(rows).length, 1);
  assert.equal(splitTitles(rows)[0].length, 3);
});

test("different authors, or different titles, never merge", () => {
  assert.equal(groupEditions([row({ hasEbook: true }), row({ hasPrint: true, authorId: "a2" })]).length, 2);
  assert.equal(groupEditions([row({ hasEbook: true }), row({ hasPrint: true, title: "Another" })]).length, 2);
});

test("two records with the same format are two books (a re-submission is not merged)", () => {
  assert.equal(groupEditions([row({ hasEbook: true }), row({ hasEbook: true })]).length, 2);
  // the print record joins only one of them
  const rows = [row({ hasEbook: true }), row({ hasEbook: true }), row({ hasPrint: true })];
  const groups = groupEditions(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups.filter((g) => g.length === 2).length, 1);
});

test("a record that already holds several formats stays whole and can take a missing one", () => {
  const combined = row({ hasEbook: true, hasPrint: true });
  const audio = row({ hasAudiobook: true });
  const print2 = row({ hasPrint: true });
  const groups = groupEditions([combined, audio, print2]);
  assert.equal(groups.length, 2); // print2 overlaps combined's print, so it stays apart
  assert.equal(groups.find((g) => g.includes(combined))!.includes(audio), true);
});

test("a newest-first list stays newest-first", () => {
  const old = row({ hasEbook: true, title: "Old" });
  const mid = row({ hasEbook: true, title: "Mid" });
  const newest = row({ hasEbook: true, title: "New" });
  assert.deepEqual(groupEditions([newest, mid, old]).map((g) => g[0].title), ["New", "Mid", "Old"]);
});

test("titleKey ignores case and spacing", () => {
  assert.equal(titleKey("  A  B "), "a b");
});
