/**
 * The admin instance's login (actions/admin-auth.ts's `adminSignIn`)
 * calls the server-exported `signIn()` from lib/auth-admin.ts directly
 * from a Server Action, rather than the client-side next-auth/react
 * hook used by the public login form (app/login/page.tsx) — so it
 * never goes through app/api/auth-admin/[...nextauth]/route.ts at all,
 * and `stripCookiePersistence` below (which only post-processes that
 * route's responses) never sees it. This is the Server Action
 * equivalent: called right after `signIn()` resolves, it re-sets the
 * same cookie value Auth.js just wrote into this action's own cookie
 * jar — but without the `maxAge`/`expires` Auth.js always applies —
 * which overrides it before the action's response is sent, since both
 * mutations land in the same outgoing cookie jar for this request.
 */
export async function stripServerActionCookiePersistence(cookieBaseName: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  for (const c of store.getAll()) {
    if (c.name !== cookieBaseName && !c.name.startsWith(`${cookieBaseName}.`)) continue;
    if (c.value === "") continue; // a deletion in progress — leave it alone, see stripCookiePersistence.
    store.set(c.name, c.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      // Deliberately no maxAge/expires — see the module comment.
    });
  }
}

/**
 * Strips the `Expires`/`Max-Age` attributes from a specific cookie (by
 * name) on an outgoing NextAuth route-handler Response, turning it into
 * a true browser *session* cookie — the browser discards it the moment
 * the whole browser process actually quits, instead of keeping it alive
 * for `session.maxAge` (30 days) the way NextAuth/Auth.js sets it by
 * default.
 *
 * Why this has to happen here, not just in the `cookies.sessionToken`
 * config in lib/auth.ts / lib/auth-admin.ts: Auth.js's JWT-strategy
 * login flow (@auth/core's handle-login.js) always computes an explicit
 * `expires: fromDate(options.session.maxAge)` for the session cookie
 * itself, regardless of whether `maxAge` is present in the configured
 * cookie options — there's no first-class "make this a session-only
 * cookie" setting. Post-processing the actual `Set-Cookie` response
 * header after Auth.js has already built it is the standard, documented
 * workaround for this exact Auth.js limitation.
 *
 * The JWT's own `exp` claim (still governed by `session.maxAge` in the
 * two auth configs, unchanged at 30 days) is deliberately left alone as
 * a defensive cap — if a cookie somehow did survive past the browser
 * session (restored by a crash-recovery feature some browsers have,
 * for instance), the token inside it still expires on its own.
 *
 * A large JWT can be split across multiple cookies by Auth.js
 * (`<name>.0`, `<name>.1`, ...) when it doesn't fit in one 4KB cookie —
 * handled here by matching on the name prefix, not an exact match.
 *
 * Deliberately leaves a cookie ALONE when its value is empty: that's
 * Auth.js actively deleting the cookie (sign-out, or an invalid/expired
 * token being cleared) via an explicit `Max-Age=0`/past `Expires`, which
 * must stay intact — stripping it there would turn a real deletion into
 * an empty-but-very-much-still-present session cookie that lingers
 * until the browser fully closes instead of disappearing immediately.
 */
export function stripCookiePersistence(response: Response, cookieBaseName: string): Response {
  const setCookieValues = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (setCookieValues.length === 0) return response;

  const rewritten = setCookieValues.map((raw) => {
    const eq = raw.indexOf("=");
    const name = raw.slice(0, eq);
    if (name !== cookieBaseName && !name.startsWith(`${cookieBaseName}.`)) return raw;
    const value = raw.slice(eq + 1, raw.indexOf(";") === -1 ? undefined : raw.indexOf(";"));
    if (value === "") return raw; // an active deletion — leave Max-Age=0/Expires in place.
    return raw.replace(/;\s*Expires=[^;]*/i, "").replace(/;\s*Max-Age=[^;]*/i, "");
  });

  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const value of rewritten) headers.append("set-cookie", value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
