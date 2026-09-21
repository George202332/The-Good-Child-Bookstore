import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { BACKEND_ROLES, type Role } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

/**
 * Route protection:
 *  - /admin/**  and /editor/** are backend-only surfaces (ADMIN, EDITOR).
 *  - /account/** is the existing frontend dashboard (READER, AUTHOR, AFFILIATE).
 *
 * These two areas now read two genuinely independent session cookies
 * (see lib/auth.ts for the public one, lib/auth-admin.ts for the
 * backend one) — getToken() here is pointed at whichever cookie is
 * actually relevant to the route being requested, rather than a
 * single shared auth() call. This is the fix for sessions bleeding
 * into each other across tabs: a backend sign-in no longer touches
 * the public session cookie at all, and vice versa, so refreshing one
 * tab can never affect the other's session.
 *
 * Affiliate click attribution: setting the "which affiliate link was
 * this visit through" cookie now happens here in middleware, not from a
 * client-side useEffect calling a Server Action. Middleware runs on
 * every single request, server-side, before any page JavaScript loads —
 * so this is guaranteed to fire and guaranteed to land, with none of the
 * timing/execution risk a client-side effect has (page not mounting in
 * time, the effect's fire-and-forget action call racing with navigation,
 * etc.). This was the real, final cause of commissions not being
 * credited even after fixing the ?ref=/?aff= mismatch: the cookie that
 * checkout depends on wasn't reliably being set in the first place.
 *
 * Only the affiliate's link code is stored (not the book id) — checkout
 * (actions/orders.ts createPendingOrder) looks the link up by that code
 * to get its real bookId/affiliateId at the moment of purchase, rather
 * than trusting whatever was baked into the cookie at click time.
 */
export default async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Admin-managed 301/302 redirects (see Admin → SEO & Marketing) — a
  // book or blog post that moved or was deleted shouldn't just 404.
  try {
    const redirect = await prisma.redirect.findUnique({ where: { fromPath: pathname } });
    if (redirect) {
      const destination = redirect.toPath.startsWith("http") ? redirect.toPath : new URL(redirect.toPath, req.nextUrl.origin);
      return NextResponse.redirect(destination, redirect.statusCode);
    }
  } catch {
    // If the database is unreachable, fall through to normal routing
    // rather than blocking the request on this check.
  }

  // /admin/login is the backend's own sign-in page — it must stay
  // reachable by signed-out visitors, or this would redirect to itself
  // in an infinite loop.
  const isAdminLoginRoute = pathname === "/admin/login";

  const isBackendRoute = (pathname.startsWith("/admin") || pathname.startsWith("/editor")) && !isAdminLoginRoute;
  if (isBackendRoute) {
    const adminToken = await getToken({ req, cookieName: "gcb-admin-session-token", secret: process.env.AUTH_SECRET });
    const role = (adminToken as { role?: string } | null)?.role;
    if (!role || !BACKEND_ROLES.includes(role as Role)) {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
    }
  }

  const isAccountRoute = pathname.startsWith("/account");
  if (isAccountRoute) {
    const publicToken = await getToken({ req, cookieName: "gcb-session-token", secret: process.env.AUTH_SECRET });
    const role = (publicToken as { role?: string } | null)?.role;
    if (!role) {
      return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
    }
    // A backend account signed in on the public session (which
    // shouldn't happen now that backend accounts only authenticate
    // through the admin instance, but kept as a defensive check) is
    // sent to /admin instead of a dashboard with no real handling for
    // that role.
    if (BACKEND_ROLES.includes(role as Role)) {
      return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
    }
  }

  const response = NextResponse.next();

  const affCode = searchParams.get("aff");
  if (affCode) {
    response.cookies.set("gcb_aff", affCode, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  const authorRefCode = searchParams.get("ref");
  if (pathname.startsWith("/signup/author") && authorRefCode) {
    response.cookies.set("gcb_author_ref", authorRefCode, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/editor/:path*", "/account/:path*", "/book/:path*", "/blog/:path*", "/signup/author", "/:slug"],
};
