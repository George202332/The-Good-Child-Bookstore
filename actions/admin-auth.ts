"use server";

import { signInAdmin, signOutAdmin } from "@/lib/auth-admin";
import { AuthError } from "next-auth";

export async function adminSignIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await signInAdmin("credentials", { email, password, redirect: false });
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
