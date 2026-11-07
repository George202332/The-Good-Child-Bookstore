import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { revisionStateOf, isAwaitingReview, authorRevisionStatus } from "../lib/revision-state";
import { describeChanges } from "../lib/revision-diff";

test("revision states: draft and sent-back edits are not waiting for a reviewer; older held records count as waiting", () => {
  assert.equal(revisionStateOf(null), "NONE");
  assert.equal(revisionStateOf({ kind: "full", state: "DRAFT" }), "DRAFT");
  assert.equal(revisionStateOf({ kind: "full", state: "PENDING" }), "PENDING");
  assert.equal(revisionStateOf({ kind: "full", state: "REJECTED" }), "REJECTED");
  assert.equal(revisionStateOf({ kind: "files", manuscriptFileId: "x" }), "PENDING");
  assert.equal(revisionStateOf({ input: {}, bookFiles: [] }), "PENDING");
  assert.equal(isAwaitingReview({ state: "DRAFT" }), false);
  assert.equal(isAwaitingReview({ state: "REJECTED" }), false);
  assert.equal(isAwaitingReview({ state: "PENDING" }), true);
});

test("author status words: Awaiting Review, Needs Attention, Draft Saved, Approved", () => {
  assert.equal(authorRevisionStatus({ state: "PENDING" }), "Awaiting Review");
  assert.equal(authorRevisionStatus({ state: "REJECTED" }), "Needs Attention");
  assert.equal(authorRevisionStatus({ state: "DRAFT" }), "Draft Saved");
  assert.equal(authorRevisionStatus(null, { state: "APPROVED" }), "Approved");
  assert.equal(authorRevisionStatus(null, null), null);
});

test("What Changed lists price, description, category and file changes, and nothing that is the same", () => {
  const live = {
    fields: { title: "A Book", description: "Old words", ebookPrice: 5, ageGroup: "4-6", coverImageUrl: "/api/images/a", submissionMetadata: { publisher: "Me", aiDeclaration: "No AI tools were used. All content is entirely human-made." } },
    files: [{ kind: "MANUSCRIPT", url: "/api/files/m1" }],
    genreName: "Picture Books",
  };
  const edit = {
    fields: { title: "A Book", description: "New words", ebookPrice: 6.5, ageGroup: "4-6", coverImageUrl: "/api/images/b", submissionMetadata: { publisher: "Me", aiDeclaration: "No AI tools were used. All content is entirely human-made." } },
    files: [{ kind: "MANUSCRIPT", url: "/api/files/m2" }],
    genreName: "Picture Books",
    subcategoryName: "",
  };
  const rows = describeChanges(live, edit);
  const labels = rows.map((r) => r.label);
  assert.deepEqual(labels.sort(), ["Cover", "Description", "Manuscript / Print Interior", "eBook Price"].sort());
  assert.equal(rows.find((r) => r.label === "eBook Price")?.after, "$6.50");
  assert.deepEqual(describeChanges(live, { ...live, subcategoryName: "" }), []);
});

test("every edit of a published book is held for review: the live book is never written, buttons say Republish", () => {
  const src = readFileSync("actions/submissions.ts", "utf8");
  const a = src.indexOf('if (existing.status === "PUBLISHED") {\n    // EVERY edit');
  const b = src.indexOf("const [category, genre] = await Promise.all", a);
  const branch = src.slice(a, b);
  assert.ok(a > 0 && b > a);
  assert.match(branch, /pendingRevisionData: JSON\.parse/);
  assert.ok(!/tx\.book\.update|prisma\.\$transaction/.test(branch), "the branch writes only the held revision, in one update");
  assert.equal((branch.match(/prisma\.book\.update/g) ?? []).length, 1);
  assert.ok(!/status: "PENDING_REVIEW"/.test(branch), "the live book keeps its status");
  assert.match(branch, /notifyReviewers\("edited"/);
  for (const f of ["app/account/books/new/EbookSubmissionForm.tsx", "app/account/books/new/PrintSubmissionForm.tsx"]) {
    const form = readFileSync(f, "utf8");
    assert.match(form, /publishLabel=\{editingPublished \? "Republish" : "Publish"\}/);
    assert.match(form, /const submitForReview = publishing;/);
  }
  assert.ok(!/live now/i.test(readFileSync("app/account/books/page.tsx", "utf8")));
});

test("approving an edit applies it; sending it back keeps the edit with the reviewer's note and leaves the live book alone", () => {
  const src = readFileSync("actions/submissions.ts", "utf8");
  const reject = src.slice(src.indexOf("export async function rejectBookRevision"), src.indexOf("export interface UpdateBookInput"));
  assert.match(reject, /state: "REJECTED"/);
  assert.ok(!/status:/.test(reject), "no change to the live book's status or fields");
  assert.match(src, /revisionStateOf\(book\.pendingRevisionData\) !== "PENDING"/);
});
