import { auth } from "@/lib/auth";
import { authAdmin } from "@/lib/auth-admin";

/**
 * For server actions genuinely shared between backend staff and
 * public accounts (e.g. canViewFinancials() is used by both an Author
 * checking their own royalties and an Accountant checking company-wide
 * revenue) — checks both independent sessions and returns whichever is
 * actually present. Prefers the admin session if, for some reason,
 * both existed at once (shouldn't normally happen since they're
 * different browsers/cookies, but never ambiguous either way).
 */
export async function authEither() {
  const adminSession = await authAdmin();
  if (adminSession?.user) return adminSession;
  return auth();
}
