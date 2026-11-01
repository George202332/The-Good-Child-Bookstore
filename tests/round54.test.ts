import test from "node:test";
import assert from "node:assert/strict";
import { inlineContentDisposition } from "../lib/file-response";
import { signedFilePath, verifySignedFile, luluFileUrl } from "../lib/signed-file-url";
import { isSiteFetchError, explainLuluError } from "../lib/lulu-validation";
import { summarizePreflight, isSiteSideFailure, type PreflightJob } from "../lib/print-preflight-result";

process.env.AUTH_SECRET = "test-secret-for-round-54";

test("a file name with an en dash, curly quotes or an emoji can be put in a header", () => {
  for (const name of ["Harper – Interior.pdf", "“Quoted” title.pdf", "Café ☕ final.pdf", 'a"b.pdf', "日本語.pdf", ""]) {
    const h = inlineContentDisposition(name);
    assert.doesNotThrow(() => new Headers({ "Content-Disposition": h }), name);
    assert.ok(h.startsWith("inline; filename=\""));
  }
});

test("the encoded name keeps the exact original", () => {
  const h = inlineContentDisposition("Harper – Interior.pdf");
  assert.ok(h.includes("filename*=UTF-8''Harper%20%E2%80%93%20Interior.pdf"));
  assert.ok(h.includes('filename="Harper _ Interior.pdf"'));
});

test("a signed link verifies, and only for its own file", () => {
  const now = Date.now();
  const path = signedFilePath("file123", 3600, now)!;
  const q = new URL("https://x.test" + path).searchParams;
  assert.equal(verifySignedFile("file123", q.get("exp"), q.get("sig"), now + 1000), true);
  assert.equal(verifySignedFile("other", q.get("exp"), q.get("sig"), now + 1000), false);
});

test("a signed link expires, and a tampered one is refused", () => {
  const now = Date.now();
  const path = signedFilePath("file123", 60, now)!;
  const q = new URL("https://x.test" + path).searchParams;
  assert.equal(verifySignedFile("file123", q.get("exp"), q.get("sig"), now + 61_000), false);
  assert.equal(verifySignedFile("file123", String(Number(q.get("exp")) + 1000), q.get("sig"), now), false);
  assert.equal(verifySignedFile("file123", q.get("exp"), "bogus", now), false);
  assert.equal(verifySignedFile("file123", null, null, now), false);
});

test("without a secret nothing is signed and the plain link is used", () => {
  const keep = process.env.AUTH_SECRET;
  delete process.env.AUTH_SECRET; delete process.env.SETTINGS_ENCRYPTION_KEY;
  assert.equal(signedFilePath("f", 60), null);
  assert.equal(luluFileUrl("/api/files/abc", "https://site.test", 60), "https://site.test/api/files/abc");
  process.env.AUTH_SECRET = keep;
});

test("luluFileUrl gives Lulu a signed, expiring link", () => {
  const u = luluFileUrl("/api/files/abc", "https://site.test/", 3600)!;
  assert.ok(u.startsWith("https://site.test/api/lulu-files/abc?exp="));
  assert.ok(u.includes("&sig="));
});

test("Lulu's 'failed to fetch' message is recognised as our side", () => {
  assert.equal(isSiteFetchError("Failed to fetch from the source URL 'https://x/api/files/1', received a 500 status code."), true);
  assert.equal(isSiteFetchError("Fonts are not embedded"), false);
  assert.ok(explainLuluError("Failed to fetch from the source URL 'x', received a 500 status code.").message.includes("problem on our side"));
});

const fetchFail = (kind: "interior" | "cover", format: "paperback" | "hardcover"): PreflightJob => ({
  kind, format, packageId: "p", state: "failed", errors: ["Failed to fetch from the source URL 'https://x/api/files/1', received a 500 status code."],
});

test("a fetch failure is reported as unavailable on our side, never as a file problem", () => {
  const jobs = [fetchFail("interior", "paperback"), fetchFail("interior", "hardcover")];
  assert.equal(isSiteSideFailure(jobs[0]), true);
  const s = summarizePreflight({ siteIssues: [], jobs, startedAt: new Date() });
  assert.equal(s.status, "UNAVAILABLE");
  assert.ok(s.issues[0].message.includes("problem on our side"));
  assert.ok(!s.issues[0].fix.toLowerCase().includes("upload it again"));
  assert.equal(s.interior, "UNAVAILABLE");
});

test("a real file problem is still reported as the author's to fix", () => {
  const jobs: PreflightJob[] = [{ kind: "interior", format: "paperback", packageId: "p", state: "failed", errors: ["fonts are not embedded"] }];
  const s = summarizePreflight({ siteIssues: [], jobs, startedAt: new Date() });
  assert.equal(s.status, "FAILED");
  assert.equal(s.interior, "FAILED");
});

import { printOptionsSummary } from "../lib/print-options-summary";

test("the hardcover cost summary names linen wrap and foil; the paperback one does not", () => {
  const base = { pageCount: 32, trimCode: "0850X0850", paperCode: "060UW444", colorCode: "FC", qualityCode: "PRE", finishCode: "M" };
  const hc = printOptionsSummary({ ...base, format: "hardcover", binding: "LW", linenCode: "N", foilCode: "G" }).join(" | ");
  assert.ok(hc.includes("32 pages") && hc.includes("Matte cover finish") && hc.includes("Navy linen wrap") && hc.includes("Gold foil stamp") && hc.includes("Full Color interior"));
  const pb = printOptionsSummary({ ...base, format: "paperback", binding: "PB", linenCode: "N", foilCode: "G" }).join(" | ");
  assert.ok(!pb.includes("linen") && !pb.includes("foil") && pb.includes("Perfect Bound"));
  const plain = printOptionsSummary({ ...base, format: "hardcover", binding: "LW", linenCode: "X", foilCode: "X" }).join(" | ");
  assert.ok(!plain.includes("foil stamp") && !plain.includes("linen wrap"));
});
