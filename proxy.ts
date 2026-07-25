import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { BACKEND_ROLES, type Role } from "@/lib/roles";

/**
 * Route protection:
 *  - /admin/**  and /editor/** are backend-only surfaces (ADMIN, EDITOR).
 *  - /account/** is the existing frontend dashboard (READER, AUTHOR, AFFILIATE).
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
export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;

  // /admin/login is the backend's own sign-in page — it must stay
  // reachable by signed-out visitors, or this would redirect to itself
  // in an infinite loop.
  const isAdminLoginRoute = pathname === "/admin/login";

  const isBackendRoute = (pathname.startsWith("/admin") || pathname.startsWith("/editor")) && !isAdminLoginRoute;
  if (isBackendRoute) {
    if (!role || !BACKEND_ROLES.includes(role as Role)) {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
    }
  }

  const isAccountRoute = pathname.startsWith("/account");
  if (isAccountRoute && !role) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  const response = NextResponse.next();

  const affCode = searchParams.get("aff");
  if (pathname.startsWith("/book/") && affCode) {
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
});

export const config = {
  matcher: ["/admin/:path*", "/editor/:path*", "/account/:path*", "/book/:path*", "/signup/author"],
};
