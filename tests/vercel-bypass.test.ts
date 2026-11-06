import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { withVercelBypass } from "../lib/signed-file-url";

const link = "https://staging.example.vercel.app/api/lulu-files/abc?exp=1&sig=xyz";
describe("Vercel staging bypass on Lulu file links", () => {
  test("added on staging when the bypass variable exists", () => {
    const out = withVercelBypass(link, { VERCEL_ENV: "preview", VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret" });
    assert.ok(out.startsWith(link + "&x-vercel-protection-bypass="));
  });
  test("never added on the live site", () => {
    assert.equal(withVercelBypass(link, { VERCEL_ENV: "production", VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret" }), link);
  });
  test("never added on a developer computer or when the variable is missing", () => {
    assert.equal(withVercelBypass(link, { VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret" }), link);
    assert.equal(withVercelBypass(link, { VERCEL_ENV: "preview" }), link);
  });
  test("only our own signed file links get it", () => {
    const other = "https://elsewhere.example/file.pdf";
    assert.equal(withVercelBypass(other, { VERCEL_ENV: "preview", VERCEL_AUTOMATION_BYPASS_SECRET: "s" }), other);
  });
});

import { parseLuluValidation, scrubSecrets } from "../lib/lulu-validation";
describe("the bypass secret never appears in Lulu error text", () => {
  test("scrubbed from a repeated address", () => {
    const t = "Failed to fetch 'https://x/api/lulu-files/a?exp=1&sig=b&x-vercel-protection-bypass=TOPSECRET' received a 401 status";
    assert.ok(!scrubSecrets(t).includes("TOPSECRET"));
    const p = parseLuluValidation({ status: "ERROR", errors: [t] }, "interior");
    assert.ok(!p.errors.join(" ").includes("TOPSECRET"));
  });
});
