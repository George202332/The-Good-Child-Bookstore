import test from "node:test";
import assert from "node:assert/strict";
import { isRejectedStatus, reasonFromPrintJob, classifyFailure, fixHint } from "../lib/lulu-rejection";

test("only Lulu's REJECTED status counts as a rejection", () => {
  assert.equal(isRejectedStatus("REJECTED"), true);
  assert.equal(isRejectedStatus("CANCELED"), false);
  assert.equal(isRejectedStatus(null), false);
});

test("reason is read from the print job in Lulu's words", () => {
  assert.equal(reasonFromPrintJob({ status: { name: "REJECTED", message: "Cover PDF has the wrong dimensions" } }), "Cover PDF has the wrong dimensions");
  assert.equal(reasonFromPrintJob({ status: { name: "REJECTED", messages: ["Interior fonts not embedded", "Cover too small"] } }), "Interior fonts not embedded; Cover too small");
  assert.equal(reasonFromPrintJob({ status: { name: "SHIPPED" } }), null);
  assert.equal(reasonFromPrintJob(null), null);
});

test("send failures are sorted into author-fixable rejections and everything else", () => {
  const lulu = classifyFailure('Lulu print job failed (400) at https://api.lulu.com: {"line_items":["Interior file: page count does not match"]}');
  assert.equal(lulu.rejected, true);
  assert.match(lulu.reason, /page count does not match/);
  assert.equal(classifyFailure("Lulu print job failed (401) at x: unauthorized").rejected, false);
  assert.equal(classifyFailure("Lulu print job failed (500) at x: boom").rejected, false);
  assert.equal(classifyFailure('Not sent to Lulu — "A Book": no cover file on record.').rejected, true);
  assert.equal(classifyFailure("Not sent to Lulu — street address is missing; city is missing.").rejected, false);
  assert.equal(classifyFailure("Lulu authentication failed (401) against x").rejected, false);
});

test("the fix hint names the file to replace", () => {
  assert.match(fixHint("Cover PDF wrong size"), /cover file/);
  assert.match(fixHint("Interior fonts not embedded"), /interior PDF/);
  assert.match(fixHint("something odd"), /check the files/);
});

test("Lulu service problems are not blamed on the author", () => {
  assert.equal(classifyFailure('Not sent to Lulu — "A Book": Lulu could not give the cover size for this book (500): x.').rejected, false);
});
