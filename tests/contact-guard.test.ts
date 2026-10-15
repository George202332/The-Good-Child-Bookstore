import test from "node:test";
import assert from "node:assert/strict";
import { checkContactSubmission, escapeHtml, singleLine, countLinks, CONTACT_LIMITS } from "../lib/contact-guard";

const NOW = 1_800_000_000_000;
const base = { name: "Jane Doe", email: "jane@example.com", topic: "Order issue", message: "Hello, where is my order?", startedAt: NOW - 20_000 };

test("a normal submission passes", () => {
  assert.deepEqual(checkContactSubmission(base, NOW), { ok: true });
});

test("filled hidden trap field is silently dropped", () => {
  const r = checkContactSubmission({ ...base, honeypot: "http://spam" }, NOW);
  assert.equal(r.ok, false);
  assert.equal((r as { silent?: boolean }).silent, true);
});

test("instant, missing or future timestamps are silently dropped", () => {
  for (const startedAt of [NOW - 500, undefined, 0, NOW + 60_000, NaN]) {
    const r = checkContactSubmission({ ...base, startedAt: startedAt as number }, NOW);
    assert.equal(r.ok, false);
    assert.equal((r as { silent?: boolean }).silent, true);
  }
});

test("a form left open for hours asks for a refresh", () => {
  const r = checkContactSubmission({ ...base, startedAt: NOW - CONTACT_LIMITS.maxFillMs - 1000 }, NOW);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /refresh/i);
});

test("bad shapes and sizes are refused with a message", () => {
  const bad = [
    { ...base, name: "" },
    { ...base, name: "A\nBcc: x@y.z" },
    { ...base, name: "<script>" },
    { ...base, email: "not-an-email" },
    { ...base, email: "a@b.co, c@d.co" },
    { ...base, message: "   " },
    { ...base, message: "x".repeat(CONTACT_LIMITS.message + 1) },
  ];
  for (const b of bad) {
    const r = checkContactSubmission(b, NOW);
    assert.equal(r.ok, false);
    assert.ok(typeof (r as { error?: string }).error === "string");
  }
});

test("too many links is refused, two are fine", () => {
  assert.equal(checkContactSubmission({ ...base, message: "see http://a.com and https://b.com" }, NOW).ok, true);
  assert.equal(checkContactSubmission({ ...base, message: "http://a.com https://b.com www.c.com" }, NOW).ok, false);
  assert.equal(countLinks("no links here"), 0);
});

test("escapeHtml and singleLine neutralise markup and line breaks", () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  assert.equal(singleLine("Hi\r\nBcc: evil@x.com"), "Hi Bcc: evil@x.com");
});
