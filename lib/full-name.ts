/**
 * A person's full account name, for author and affiliate views that list the
 * accounts a referral or commission came from. This replaces the earlier
 * first-name-only rule. Extra spaces are tidied; an empty or missing name
 * falls back to a neutral label so a row is never blank. (The account ID is
 * still masked separately, see lib/mask-account-number.ts.)
 */
export function fullAccountName(name: string | null | undefined, fallback = "Account"): string {
  const tidy = (name ?? "").trim().replace(/\s+/g, " ");
  return tidy || fallback;
}
