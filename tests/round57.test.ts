import test from "node:test";
import assert from "node:assert/strict";
import { withTimeout, RouteTimeoutError, lockNote, workingLabel, timeoutMessage, failureMessage, ROUTE_TIMEOUT_MS, type PayRoute } from "../lib/checkout-routes";
import { sameOrderLines } from "../lib/pending-order";
import { buildLibraryRows } from "../lib/my-library";
import { bookAuthorDisplayName } from "../lib/book-author-name";

test("each pay route has its own timeout: slow work rejects, fast work resolves, nothing spins forever", async () => {
  assert.equal(ROUTE_TIMEOUT_MS, 30000);
  assert.equal(await withTimeout(Promise.resolve("ok"), 50), "ok");
  let fired = false;
  await assert.rejects(withTimeout(new Promise(() => undefined), 20, () => { fired = true; }), RouteTimeoutError);
  assert.equal(fired, true);
  await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 50), /boom/);
});

test("route wording: another route's lock note and labels never say Processing, and messages name only their own route", () => {
  const routes: PayRoute[] = ["paypal", "card", "saved"];
  for (const r of routes) {
    assert.ok(!/processing/i.test(workingLabel(r)));
    assert.ok(!/processing/i.test(timeoutMessage(r)) && !/processing/i.test(failureMessage(r)));
    assert.equal(lockNote(null, r), null);
    assert.equal(lockNote(r, r), null);
  }
  assert.equal(lockNote("paypal", "card"), "Payment in progress");
  assert.equal(lockNote("card", "paypal"), "Payment in progress");
  assert.match(timeoutMessage("paypal"), /PayPal/); assert.ok(!/card/i.test(timeoutMessage("paypal")));
  assert.match(timeoutMessage("card"), /card payment/); assert.ok(!/PayPal/.test(timeoutMessage("card")));
  assert.match(timeoutMessage("card"), /Nothing has been charged/);
});

test("pending order reuse: same books, formats and amounts match whatever the order; anything different does not", () => {
  const a = [{ bookId: "b1", format: "paperback", gross: 20 }, { bookId: "b2", format: "ebook", gross: 5.5 }];
  assert.equal(sameOrderLines(a, [a[1], a[0]]), true);
  assert.equal(sameOrderLines(a, [{ ...a[0], gross: 20.01 }, a[1]]), false);
  assert.equal(sameOrderLines(a, [a[0]]), false);
  assert.equal(sameOrderLines(a, [{ ...a[0], format: "hardcover" }, a[1]]), false);
});

const name = (b: Parameters<typeof bookAuthorDisplayName>[0]) => bookAuthorDisplayName(b);
const good = (bookId: string, format: string | null, extra: object = {}) => ({
  bookId, format,
  book: { title: `T ${bookId}`, isbn: null, submissionMetadata: null, author: { penName: "jane doe", user: { name: "Jane" } }, files: [], ...extra },
});

test("library: groups copies per book and format, and one broken record never crashes the page", () => {
  const lines = [
    good("b1", "ebook"), good("b1", "ebook"), good("b1", "audiobook", { files: [{ kind: "AUDIOBOOK" }] }),
    { bookId: "b3", format: "ebook", book: null },                      // a book that no longer exists
    { bookId: "", format: "ebook", book: { title: "x" } },               // no book id
    { bookId: "b4", format: "paperback", book: { title: null } },        // a record missing its title
    good("b5", null, { submissionMetadata: "not an object" }),           // odd metadata
    { bookId: "b6", format: "ebook", book: { title: "No Author", author: null } }, // older record with no author at all
  ];
  const { rows, skipped } = buildLibraryRows(lines as never, (b) => name({ submissionMetadata: b.submissionMetadata, author: { penName: b.author?.penName ?? null, user: { name: b.author?.user?.name ?? "" } } }));
  assert.equal(skipped, 3);
  const b1 = rows.find((r) => r.id === "b1" && r.rawFormat === "ebook");
  assert.equal(b1?.copies, 2);
  assert.equal(rows.find((r) => r.id === "b1" && r.rawFormat === "audiobook")?.hasAudio, true);
  assert.equal(rows.find((r) => r.id === "b5")?.format, "—");
  assert.equal(rows.find((r) => r.id === "b6")?.author, "");
  assert.equal(rows.length, 4);
});

test("library: a throwing author-name lookup skips that record only", () => {
  const { rows, skipped } = buildLibraryRows([good("b1", "ebook"), good("b2", "ebook")] as never, (b) => { if (b.title === "T b1") throw new Error("bad"); return "ok"; });
  assert.equal(skipped, 1); assert.equal(rows.length, 1); assert.equal(rows[0].id, "b2");
});
