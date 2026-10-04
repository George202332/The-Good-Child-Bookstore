"use server";

import { signInAdmin, signOutAdmin, authAdmin } from "@/lib/auth-admin";
import { AuthError } from "next-auth";
import { stripServerActionCookiePersistence } from "@/lib/session-cookie";
import type { Role } from "@/lib/roles";

export async function adminSignIn(email: string, password: string): Promise<{ ok: boolean; error?: string; role?: Role }> {
  try {
    await signInAdmin("credentials", { email, password, redirect: false });
    // signInAdmin() just wrote the admin session cookie straight into
    // this Server Action's own cookie jar with Auth.js's default
    // 30-day persistence — never through app/api/auth-admin/'s route
    // handlers, so lib/session-cookie.ts's response-based stripping
    // never runs for this path. Overridden here instead.
    await stripServerActionCookiePersistence("gcb-admin-session-token");
    // Amendment 12: an Investor has no business landing on /admin (it
    // has no equivalent page there at all — see app/investor/**), so
    // the login page needs to know which landing page to send this
    // particular role to. Read back from the session this action just
    // wrote, rather than trusting anything client-supplied.
    const session = await authAdmin();
    return { ok: true, role: session?.user?.role as Role | undefined };
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: "That email or password isn't right." };
    }
    throw e;
  }
}

export async function adminSignOut(): Promise<void> {
  await signOutAdmin({ redirect: false });
}
