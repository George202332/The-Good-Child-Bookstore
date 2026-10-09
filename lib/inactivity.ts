/**
 * Pure logic behind components/SessionInactivityTimer.tsx, kept free of
 * React/DOM so it can be unit-tested (tests/inactivity.test.ts).
 *
 * Why this exists: the timer persists its "last activity" timestamp in
 * localStorage (so a mobile tab that was evicted and reloaded still
 * knows how long it has really been idle). localStorage outlives the
 * SESSION, though — closing the browser drops the session-only cookie
 * (lib/session-cookie.ts), the JWT can expire, a sign-out can happen
 * from another tab — and none of those cleared the stored timestamp. The
 * next sign-in then mounted a brand-new timer that read the OLD
 * session's timestamp, saw "more than 30 minutes idle", and signed the
 * user straight back out. That sign-out also deleted the key, which is
 * why the second attempt always worked.
 *
 * The fix is to judge idleness only against activity that belongs to the
 * CURRENT session: the server stamps `signedInAt` into the JWT at the
 * moment of sign-in, and any stored timestamp older than that is
 * treated as belonging to a previous session and is ignored.
 */

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Returns the timestamp (ms since epoch) to treat as "last real
 * activity" for the current session.
 *
 *  - `stored`: raw localStorage value (or null).
 *  - `sessionStartedAt`: JWT `signedInAt` in ms, or undefined for a
 *    session issued before that claim existed (legacy behaviour: trust
 *    the stored value).
 *
 * Never returns a value in the future (client/server clock skew).
 */
export function resolveLastActivity(stored: string | null, now: number, sessionStartedAt?: number): number {
  let last = now;
  if (stored !== null && stored !== "") {
    const n = Number(stored);
    if (Number.isFinite(n) && n > 0) last = n;
  }
  if (typeof sessionStartedAt === "number" && Number.isFinite(sessionStartedAt) && last < sessionStartedAt) {
    last = sessionStartedAt;
  }
  return Math.min(last, now);
}

export function isIdleExpired(lastActivity: number, now: number, timeoutMs: number = INACTIVITY_TIMEOUT_MS): boolean {
  return now - lastActivity >= timeoutMs;
}
