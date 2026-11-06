import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isSiteFetchError, explainLuluError } from "../lib/lulu-validation";
import { summarizePreflight, isSiteSideFailure, type PreflightJob } from "../lib/print-preflight-result";

const MSG = "File Type: The file you upload is not a valid PDF.";
const job = (kind: "interior" | "cover"): PreflightJob => ({ kind, format: "paperback", packageId: "p", id: "j", state: "failed", errors: [MSG] });

describe("Lulu 'not a valid PDF' for a file our own checks opened", () => {
  test("is treated as a problem on our side, not the author's file", () => {
    assert.equal(isSiteFetchError(MSG), true);
    assert.match(explainLuluError(MSG).message, /problem on our side/);
    assert.equal(isSiteSideFailure(job("interior")), true);
  });
  test("the author sees 'unavailable', never 'Rejected'", () => {
    const s = summarizePreflight({ siteIssues: [], jobs: [job("interior"), job("cover")], startedAt: new Date() });
    assert.equal(s.status, "UNAVAILABLE");
    assert.equal(s.interior, "UNAVAILABLE");
    assert.equal(s.cover, "UNAVAILABLE");
  });
  test("a real problem in the file (fonts, size) is still a rejection", () => {
    const s = summarizePreflight({ siteIssues: [], jobs: [{ ...job("interior"), errors: ["Page size does not match the trim"] }], startedAt: new Date() });
    assert.equal(s.status, "FAILED");
  });
  test("an unreadable PDF is still refused by the site's own check before Lulu is asked", () => {
    const s = summarizePreflight({ siteIssues: [{ code: "UNREADABLE", message: "x", fix: "y" }], jobs: [], startedAt: new Date() });
    assert.equal(s.status, "FAILED");
  });
});
