import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { BACKEND_ROLES, type Role } from "@/lib/roles";

/**
 * Route protection:
 *  - /admin/**  and /editor/** are backend-only surfaces (ADMIN, EDITOR).
 *  - /account/** is the existing frontend dashboard (READER, AUTHOR, AFFILIATE).
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;

  const isBackendRoute = pathname.startsWith("/admin") || pathname.startsWith("/editor");
  if (isBackendRoute) {
    if (!role || !BACKEND_ROLES.includes(role as Role)) {
      return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
    }
  }

  const isAccountRoute = pathname.startsWith("/account");
  if (isAccountRoute && !role) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/editor/:path*", "/account/:path*"],
};
