import test from "node:test";
import assert from "node:assert/strict";
import { summarizePreflight, coverKeyFor, packageKey, PREFLIGHT_TIMEOUT_MS, type PreflightJob } from "../lib/print-preflight-result";

const job = (over: Partial<PreflightJob>): PreflightJob => ({ kind: "interior", format: "paperback", packageId: "P", id: "1", state: "running", errors: [], ...over });
const started = new Date("2026-10-29T10:00:00Z");

test("site problems fail the check straight away, with the fix", () => {
  const r = summarizePreflight({ siteIssues: [{ code: "FONTS", message: "Fonts are not embedded", fix: "Re-export" }], jobs: [], startedAt: started });
  assert.equal(r.status, "FAILED");
  assert.equal(r.issues[0].source, "site");
});

test("Lulu has the final word: a Lulu failure fails even when the site checks passed", () => {
  const r = summarizePreflight({ siteIssues: [], jobs: [job({ state: "failed", errors: ["make sure all fonts are embedded"] }), job({ kind: "cover", state: "passed" })], startedAt: started });
  assert.equal(r.status, "FAILED");
  assert.match(r.issues[0].message, /fonts/);
  assert.equal(r.issues[0].source, "lulu");
});

test("passes only when the site is clean and every Lulu job passed", () => {
  assert.equal(summarizePreflight({ siteIssues: [], jobs: [job({ state: "passed" }), job({ kind: "cover", state: "passed" })], startedAt: started }).status, "PASSED");
  assert.equal(summarizePreflight({ siteIssues: [], jobs: [job({ state: "passed" }), job({ kind: "cover", state: "running" })], startedAt: started, now: new Date(started.getTime() + 1000) }).status, "CHECKING");
  assert.notEqual(summarizePreflight({ siteIssues: [], jobs: [], startedAt: started }).status, "PASSED");
});

test("a job that could not start, or took too long, is UNAVAILABLE - never a pass", () => {
  assert.equal(summarizePreflight({ siteIssues: [], jobs: [job({ state: "error", errors: ["no reply"] })], startedAt: started }).status, "UNAVAILABLE");
  const late = new Date(started.getTime() + PREFLIGHT_TIMEOUT_MS + 1000);
  assert.equal(summarizePreflight({ siteIssues: [], jobs: [job({})], startedAt: started, now: late }).status, "UNAVAILABLE");
  assert.equal(summarizePreflight({ siteIssues: [], jobs: [], startedAt: started, unavailableReason: "not set up" }).status, "UNAVAILABLE");
});

test("the same Lulu message from paperback and hardcover is shown once per format label", () => {
  const r = summarizePreflight({
    siteIssues: [],
    jobs: [job({ kind: "cover", format: "paperback", state: "failed", errors: ["cover size wrong"] }), job({ kind: "cover", format: "hardcover", state: "failed", errors: ["cover size wrong"] })],
    startedAt: started,
  });
  assert.equal(r.issues.length, 2);
});

test("cover key and package key are stable", () => {
  assert.equal(coverKeyFor({ customCoverFileId: "f1", frontCoverImageUrl: "/x" }), "custom:f1");
  assert.equal(coverKeyFor({ frontCoverImageUrl: "/api/images/a" }), "front:/api/images/a");
  assert.equal(packageKey(["B", "A"]), "A,B");
});

import { decidePreflightGate, PREFLIGHT_NEEDED_MESSAGE, PREFLIGHT_VALIDITY_MS } from "../lib/print-preflight-gate";

const keys = { interiorFileId: "f1", coverKey: "front:/a", packageIds: "P1" };
const rec = (status: string, ageMs = 1000) => ({ id: "c1", status, createdAt: new Date(Date.now() - ageMs), reasons: [] });

test("gate: sending for review needs a passing check for exactly these files", () => {
  assert.equal(decidePreflightGate({ keys, latest: rec("PASSED"), saved: null, requirePass: true }).ok, true);
  for (const s of ["FAILED", "CHECKING", "UNAVAILABLE"]) {
    const r = decidePreflightGate({ keys, latest: rec(s), saved: null, requirePass: true });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, PREFLIGHT_NEEDED_MESSAGE);
  }
  assert.equal(decidePreflightGate({ keys, latest: null, saved: null, requirePass: true }).ok, false);
});

test("gate: saving a draft is never blocked, and the latest result is kept", () => {
  const r = decidePreflightGate({ keys, latest: rec("FAILED"), saved: null, requirePass: false });
  assert.equal(r.ok, true);
  assert.equal(r.save?.status, "FAILED");
});

test("gate: an old pass is not trusted, but an edit with the same files keeps its saved pass", () => {
  assert.equal(decidePreflightGate({ keys, latest: rec("PASSED", PREFLIGHT_VALIDITY_MS + 1000), saved: null, requirePass: true }).ok, false);
  const saved = { status: "PASSED" as const, checkedAt: "x", checkId: "c0", ...keys, reasons: [] };
  assert.equal(decidePreflightGate({ keys, latest: null, saved, requirePass: true }).ok, true);
  assert.equal(decidePreflightGate({ keys: { ...keys, interiorFileId: "f2" }, latest: null, saved, requirePass: true }).ok, false);
});
