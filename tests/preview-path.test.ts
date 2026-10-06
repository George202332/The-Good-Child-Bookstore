import test from "node:test";
import assert from "node:assert/strict";
import { validatePreviewPath } from "../lib/preview-path";

test("accepts normal public paths", () => {
  for (const p of ["/", "/bookshelf", "/blog?x=1", "/book/abc#top"]) assert.equal(validatePreviewPath(p).ok, true, p);
});

test("rejects unsafe paths", () => {
  for (const p of ["", "blog", "/admin", "/Admin/users", "/investor/x", "/editor", "//evil.com", "/a//b", "https://x.com", "/x?u=http://y", "/../admin", "/%2e%2e/admin", "/a\\b", "/a b"]) {
    assert.equal(validatePreviewPath(p).ok, false, p);
  }
});
