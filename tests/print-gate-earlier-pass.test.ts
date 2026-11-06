import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decidePreflightGate, PREFLIGHT_NEEDED_MESSAGE } from "../lib/print-preflight-gate";

const keys = { interiorFileId: "pdf1", coverKey: "front:/c.png", packageIds: "A" };
const now = new Date("2026-11-06T10:00:00Z");
const rec = (id: string, status: string, minutesAgo: number) => ({ id, status, createdAt: new Date(now.getTime() - minutesAgo * 60000), reasons: [] as string[] });

describe("print gate: a pass for the same two files is not cancelled by a later re-run", () => {
  test("latest check is still CHECKING but an earlier one PASSED: submit goes through", () => {
    const r = decidePreflightGate({ keys, latest: rec("new", "CHECKING", 1), passed: { ...rec("old", "PASSED", 30), packageIds: "A" }, saved: null, requirePass: true, now });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.save?.checkId, "old");
  });
  test("latest check was UNAVAILABLE after an earlier pass: submit goes through", () => {
    const r = decidePreflightGate({ keys, latest: rec("new", "UNAVAILABLE", 1), passed: { ...rec("old", "PASSED", 30), packageIds: "A" }, saved: null, requirePass: true, now });
    assert.equal(r.ok, true);
  });
  test("pass found for the same files with a different package list (setting edited since) is accepted", () => {
    const r = decidePreflightGate({ keys, latest: null, passed: { ...rec("old", "PASSED", 30), packageIds: "B" }, saved: null, requirePass: true, now });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.save?.packageIds, "B");
  });
  test("a pass older than 30 days is not accepted", () => {
    const r = decidePreflightGate({ keys, latest: null, passed: { ...rec("old", "PASSED", 31 * 24 * 60), packageIds: "A" }, saved: null, requirePass: true, now });
    assert.equal(r.ok, false);
  });
  test("no pass at all is still refused with the usual message", () => {
    const r = decidePreflightGate({ keys, latest: rec("new", "FAILED", 1), passed: null, saved: null, requirePass: true, now });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error, PREFLIGHT_NEEDED_MESSAGE);
  });
  test("only a FAILED or CHECKING check exists: still refused", () => {
    for (const status of ["FAILED", "CHECKING", "UNAVAILABLE"]) {
      const r = decidePreflightGate({ keys, latest: rec("x", status, 1), passed: null, saved: null, requirePass: true, now });
      assert.equal(r.ok, false, status);
    }
  });
});
