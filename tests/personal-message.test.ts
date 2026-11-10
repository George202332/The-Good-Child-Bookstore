import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { checkMessage, cleanMessage, feeForOrder, isValidFee, personalMessageSetup, canPersonalise, PERSONAL_MESSAGE_MAX } from "../lib/personal-message";
import { buildPersonalisedInterior, wrapLines } from "../lib/personal-interior";

test("clean messages pass the automatic check", () => {
  for (const t of ["For Amara, on your 7th birthday. Love, Grandpa", "Happy reading, Dickens fan!", "To Liam: may you always be brave."]) assert.equal(checkMessage(t).flagged, false, t);
});
test("offensive or unsuitable messages are held, even when disguised", () => {
  for (const t of ["f.u.c.k you", "you are a b1tch", "I hate you", "visit www.example.com", "call 0712 345 678 now", "mail me a@b.com"])  {
    assert.equal(checkMessage(t).flagged, true, t);
  }
  assert.ok(checkMessage("go to www.spam.com").reasons.some((x) => /web address/.test(x)));
});
test("messages are trimmed and capped", () => {
  assert.equal(cleanMessage("  hi   there \n\n\n\nbye "), "hi there \n\nbye");
  assert.equal(cleanMessage("x".repeat(500)).length, PERSONAL_MESSAGE_MAX);
  assert.equal(cleanMessage(42), "");
});
test("the fee is per personalised line, zero by default", () => {
  assert.equal(feeForOrder(0, 2), 0);
  assert.equal(feeForOrder(2, 0), 0);
  assert.equal(feeForOrder(2, 1.25), 2.5);
  assert.ok(isValidFee(0) && isValidFee(20) && !isValidFee(-1) && !isValidFee(21) && !isValidFee(NaN));
});
test("only printed copies can carry a message", () => {
  assert.ok(canPersonalise("paperback") && canPersonalise("hardcover"));
  assert.ok(!canPersonalise("ebook") && !canPersonalise("audiobook") && !canPersonalise(null));
});
test("the author's setup is read from the saved print details", () => {
  assert.deepEqual(personalMessageSetup({ personalMessageEnabled: true, personalMessagePage: 5, personalMessageDefaultLine: "For you" }), { enabled: true, page: 5, defaultLine: "For you" });
  assert.equal(personalMessageSetup(null).enabled, false);
  assert.equal(personalMessageSetup({}).page, 3);
});
test("text wraps to the page width", () => {
  const lines = wrapLines("one two three four five six", (s) => s.length * 10, 80);
  assert.ok(lines.every((l) => l.length * 10 <= 80));
});
test("the per-order interior keeps every page and size, changing only the reserved page", async () => {
  const src = await PDFDocument.create();
  for (let i = 0; i < 6; i++) src.addPage([432, 648]);
  const bytes = await src.save();
  const r = await buildPersonalisedInterior({ source: bytes, page: 3, text: "For Amara, with all my love", style: "script" });
  assert.ok(r.ok);
  if (!r.ok) return;
  const out = await PDFDocument.load(r.bytes);
  assert.equal(out.getPageCount(), 6);
  assert.deepEqual(out.getPage(2).getSize(), { width: 432, height: 648 });
  const bad = await buildPersonalisedInterior({ source: bytes, page: 9, text: "hi", style: "classic" });
  assert.equal(bad.ok, false);
  const none = await buildPersonalisedInterior({ source: bytes, page: 3, text: "   ", style: "classic" });
  assert.equal(none.ok, false);
});
