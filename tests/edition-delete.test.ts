import test from "node:test";
import assert from "node:assert/strict";
import { planEditionDelete, uploadedFileIdsIn } from "../lib/edition-delete";

const rec = (e: boolean, a: boolean, p: boolean) => ({ hasEbook: e, hasAudiobook: a, hasPrint: p });

test("a record holding only the edition being deleted is removed whole", () => {
  assert.deepEqual(planEditionDelete(rec(true, true, false), "digital"), { kind: "remove-record" });
  assert.deepEqual(planEditionDelete(rec(false, false, true), "print"), { kind: "remove-record" });
});

test("an older combined record only has the chosen part cleared", () => {
  assert.deepEqual(planEditionDelete(rec(true, false, true), "digital"), { kind: "clear-part" });
  assert.deepEqual(planEditionDelete(rec(true, false, true), "print"), { kind: "clear-part" });
});

test("deleting from a tab the record does not belong to is refused", () => {
  assert.deepEqual(planEditionDelete(rec(true, false, false), "print"), { kind: "wrong-tab" });
  assert.deepEqual(planEditionDelete(rec(false, false, true), "digital"), { kind: "wrong-tab" });
});

test("uploaded file ids are found in addresses and metadata", () => {
  const ids = uploadedFileIdsIn(["/api/files/abc123", '{"printReadyPdfFileId":"xyz9","frontCoverImageUrl":"/api/files/img7"}', null]);
  assert.deepEqual(ids.sort(), ["abc123", "img7", "xyz9"]);
});
