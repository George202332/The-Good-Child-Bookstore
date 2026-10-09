import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLastActivity, isIdleExpired, INACTIVITY_TIMEOUT_MS } from "../lib/inactivity";

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

test("regression: stale timestamp from a previous session is ignored right after a fresh sign-in", () => {
  const stale = String(NOW - 5 * HOUR);
  const last = resolveLastActivity(stale, NOW, NOW - 2000);
  assert.equal(isIdleExpired(last, NOW), false);
});

test("legacy session without signedInAt keeps trusting the stored value", () => {
  const stale = String(NOW - 5 * HOUR);
  assert.equal(isIdleExpired(resolveLastActivity(stale, NOW), NOW), true);
});

test("genuine idleness within the current session still expires", () => {
  const signedIn = NOW - 3 * HOUR;
  const stored = String(NOW - INACTIVITY_TIMEOUT_MS - 1000);
  assert.equal(isIdleExpired(resolveLastActivity(stored, NOW, signedIn), NOW), true);
});

test("recent activity within the current session does not expire", () => {
  const stored = String(NOW - 60_000);
  assert.equal(isIdleExpired(resolveLastActivity(stored, NOW, NOW - 3 * HOUR), NOW), false);
});

test("missing or garbage stored value falls back to now", () => {
  for (const v of [null, "", "abc", "NaN", "-5", "0"]) {
    assert.equal(resolveLastActivity(v, NOW), NOW);
  }
});

test("future timestamps (clock skew) are clamped to now", () => {
  assert.equal(resolveLastActivity(String(NOW + HOUR), NOW), NOW);
  assert.equal(resolveLastActivity(null, NOW, NOW + 5000), NOW);
});

test("boundary: exactly the timeout counts as expired", () => {
  assert.equal(isIdleExpired(NOW - INACTIVITY_TIMEOUT_MS, NOW), true);
  assert.equal(isIdleExpired(NOW - INACTIVITY_TIMEOUT_MS + 1, NOW), false);
});
