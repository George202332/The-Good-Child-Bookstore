import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailVerificationRequired } from "@/components/EmailVerificationRequired";
import { TwoFactorChallengeScreen } from "@/components/TwoFactorChallengeScreen";
import { SessionInactivityTimer } from "@/components/SessionInactivityTimer";
import { BackNavigationGuard } from "@/components/BackNavigationGuard";

export const dynamic = "force-dynamic";

/**
 * The gate every /account/** page passes through before its own
 * content renders — wraps the whole route group rather than each
 * page individually, so neither check can accidentally be skipped by
 * a page that forgets to call it.
 *
 * Two independent gates, checked in this order:
 *
 *  1. Email verification (fresh from the database — emailVerifiedAt
 *     is never cached in the session/JWT, so a click on the "Activate
 *     account" link is reflected on the very next request, no sign-out
 *     required). Unverified → EmailVerificationRequired, no children,
 *     no dashboard chrome at all.
 *
 *  2. Two-factor authentication (from the session/JWT — see
 *     lib/auth.ts and types/next-auth.d.ts). Enabled-but-not-yet-
 *     verified-this-session → TwoFactorChallengeScreen, same treatment.
 *
 * Middleware (proxy.ts) already redirects a signed-out visitor to
 * /login before this layout ever runs, so `session` below is only
 * ever missing in the small window a session cookie expires between
 * requests — handled defensively rather than assumed away.
 *
 * SessionInactivityTimer is mounted once, right here, rather than
 * inside each page's DashboardShell — a layout.tsx wraps every current
 * and future page under /account/**, for every role that lands here
 * (Reader, Author, and anyone with affiliate capability attached to
 * either), so the 30-minute auto-logout can never be silently skipped
 * by a page that doesn't render DashboardShell.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, emailVerifiedAt: true } });
  if (!user) redirect("/login");

  if (!user.emailVerifiedAt) {
    return (
      <>
        <SessionInactivityTimer />
        <BackNavigationGuard />
        <EmailVerificationRequired email={user.email} />
      </>
    );
  }

  if (session.user.twoFactorEnabled && !session.user.twoFactorVerified) {
    return (
      <>
        <SessionInactivityTimer />
        <BackNavigationGuard />
        <TwoFactorChallengeScreen />
      </>
    );
  }

  return (
    <>
      <SessionInactivityTimer />
      <BackNavigationGuard />
      {children}
    </>
  );
}
