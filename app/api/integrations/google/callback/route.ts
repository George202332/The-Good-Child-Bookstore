import { NextResponse } from "next/server";
import { authAdmin } from "@/lib/auth-admin";
import { exchangeCodeAndStoreTokens } from "@/lib/google/oauth";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

/**
 * TASK 2.1 — Redirect/callback handler.
 *
 * GET /api/integrations/google/callback
 *
 * This is the exact URL that must be registered as an "Authorized
 * redirect URI" in the Google Cloud Console OAuth client (see Task 3).
 * Google redirects here with either `code` (success) or `error`
 * (user declined, or something went wrong) as query parameters.
 *
 * Verifies the `state` cookie set by the auth-initiation route before
 * doing anything else — see that route's comment for why. Then
 * exchanges the code for tokens and links them to whichever admin is
 * currently logged in (the linking-to-the-active-user step the brief
 * asked for): re-checks the admin session here rather than trusting
 * whatever was true when the flow started, in case the session
 * expired mid-flow.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const returnedState = url.searchParams.get("state");
  const cookieState = request.headers.get("cookie")?.match(/gcb-google-oauth-state=([^;]+)/)?.[1];

  const redirectTo = (params: string) => NextResponse.redirect(new URL(`/admin/api-management${params}`, getPublicSiteUrl()));

  if (error) {
    return redirectTo(`?googleError=${encodeURIComponent(`Google sign-in was cancelled or failed: ${error}`)}`);
  }
  if (!code) {
    return redirectTo(`?googleError=${encodeURIComponent("No authorization code was returned by Google.")}`);
  }
  if (!returnedState || !cookieState || returnedState !== cookieState) {
    return redirectTo(`?googleError=${encodeURIComponent("Security check failed (state mismatch) — please try connecting again.")}`);
  }

  const session = await authAdmin();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin/login", getPublicSiteUrl()));
  }

  try {
    await exchangeCodeAndStoreTokens(session.user.id, code);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Couldn't complete Google sign-in.";
    return redirectTo(`?googleError=${encodeURIComponent(message)}`);
  }

  const res = redirectTo("?googleConnected=1");
  res.cookies.delete("gcb-google-oauth-state");
  return res;
}
