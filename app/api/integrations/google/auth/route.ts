import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { authAdmin } from "@/lib/auth-admin";
import { generateGoogleAuthUrl } from "@/lib/google/oauth";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

/**
 * TASK 2.1 — Auth URL generation route.
 *
 * GET /api/integrations/google/auth
 *
 * Admin-only (this integration is exposed under /admin/email, not to
 * regular reader/author accounts). Pulls the Client ID from the
 * database (via generateGoogleAuthUrl -> getGoogleCredentials) and
 * redirects the browser straight to Google's consent screen.
 *
 * CSRF protection: generates a random `state` value and stores it in a
 * short-lived, httpOnly cookie. The callback route below reads this
 * same cookie and rejects the exchange if Google's returned `state`
 * doesn't match — this is what stops a third party from tricking an
 * admin's browser into completing an OAuth flow they didn't start.
 */
export async function GET() {
  const session = await authAdmin();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/admin/login", getPublicSiteUrl()));
  }

  let authUrl: string;
  const state = randomBytes(24).toString("hex");
  try {
    authUrl = await generateGoogleAuthUrl(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Couldn't start Google sign-in.";
    return NextResponse.redirect(new URL(`/admin/api-management?googleError=${encodeURIComponent(message)}`, getPublicSiteUrl()));
  }

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("gcb-google-oauth-state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — plenty for a consent-screen round trip
    path: "/",
  });
  return res;
}
