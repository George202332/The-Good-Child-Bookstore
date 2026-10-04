"use server";

import { signInAdmin, signOutAdmin } from "@/lib/auth-admin";
import { AuthError } from "next-auth";
import { stripServerActionCookiePersistence } from "@/lib/session-cookie";

export async function adminSignIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await signInAdmin("credentials", { email, password, redirect: false });
    // signInAdmin() just wrote the admin session cookie straight into
    // this Server Action's own cookie jar with Auth.js's default
    // 30-day persistence — never through app/api/auth-admin/'s route
    // handlers, so lib/session-cookie.ts's response-based stripping
    // never runs for this path. Overridden here instead.
    await stripServerActionCookiePersistence("gcb-admin-session-token");
    return { ok: true };
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
