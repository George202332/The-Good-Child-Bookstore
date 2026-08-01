/**
 * ROLE MODEL
 *
 * Confirmed with the project owner:
 *   - READER and AUTHOR are the two public-facing signup roles.
 *     AFFILIATE was removed as a standalone role per explicit
 *     instruction — every affiliate capability (referral links,
 *     promotion links, referred-author tracking, Tier commissions) is
 *     already fully available to an Author account via its
 *     AffiliateProfile bolt-on (see lib/affiliate-capability.ts), so a
 *     separate account type was pure redundancy. Signup now offers
 *     "Reader" or "Author / Affiliate" — the latter still just creates
 *     an AUTHOR account (with an AffiliateProfile alongside it, same as
 *     before), the combined name reflects what the account already do.
 *   - EDITOR, CHIEF_EDITOR, ADMIN, ACCOUNTANT are new, backend/internal-only
 *     roles with no matching UI in the original frontend. EDITOR handles
 *     book/blog moderation (approve, send back for revision) but can only
 *     *propose* a Suspend or Withdraw decision — CHIEF_EDITOR (or ADMIN)
 *     has to ratify it before it actually takes effect. ACCOUNTANT is
 *     read-only access to all financial data (transactions, revenue
 *     breakdowns, payouts) with no ability to moderate content or manage
 *     users/site settings — added per explicit request for a role that
 *     "fetches all accounting information" without broader admin power.
 */

export type Role = "READER" | "AUTHOR" | "EDITOR" | "CHIEF_EDITOR" | "ADMIN" | "ACCOUNTANT";

export const FRONTEND_ROLES: Role[] = ["READER", "AUTHOR"];
export const BACKEND_ROLES: Role[] = ["EDITOR", "CHIEF_EDITOR", "ADMIN", "ACCOUNTANT"];

export const PERMISSIONS: Record<Role, string[]> = {
  ADMIN: [
    "users:manage",
    "books:approve",
    "blogs:approve",
    "homepage:manage",
    "finance:view",
    "finance:adjustRoyalties",
    "affiliate:manageSettings",
    "payments:manageGateways",
    "coupons:manage",
    "seo:manage",
    "analytics:view",
    "dashboards:accessAll",
  ],
  EDITOR: [
    "books:review",
    "blogs:review",
    "drafts:approve",
    "drafts:reject",
    "metadata:edit",
    "content:publish",
  ],
  CHIEF_EDITOR: [
    "books:review",
    "blogs:review",
    "drafts:approve",
    "drafts:reject",
    "metadata:edit",
    "content:publish",
    "books:ratifySuspendWithdraw",
  ],
  ACCOUNTANT: [
    "finance:view",
    "analytics:view",
    "transactions:view",
    "payouts:view",
  ],
  AUTHOR: [
    "books:upload",
    "books:editOwn",
    "blogs:createOwn",
    "sales:viewOwn",
    "royalties:viewOwn",
    "payouts:request",
    "affiliatePerformance:viewForOwnBooks",
    "referralLinks:generate",
    "commissions:view",
    "traffic:view",
    "reports:download",
  ],
  READER: [
    "books:purchase",
    "ebooks:downloadPurchased",
    "reviews:write",
    "wishlist:manage",
    "authors:follow",
    "subscriptions:manage",
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

/** EDITOR/CHIEF_EDITOR cannot see financial information — explicit per
 * the brief. ACCOUNTANT exists specifically to see financial information. */
export function canViewFinancials(role: Role): boolean {
  return role === "ADMIN" || role === "AUTHOR" || role === "ACCOUNTANT";
}

/** ACCOUNTANT can view the financial admin pages (Transactions, Analytics,
 * Payouts) but cannot moderate books/blogs, manage users, or edit site
 * content — narrower than ADMIN, distinct from EDITOR's moderation-only
 * scope. */
export function canModerateContent(role: Role): boolean {
  return role === "ADMIN" || role === "EDITOR" || role === "CHIEF_EDITOR";
}

/** Only Admin and Chief Editor can ratify an Editor's proposed Suspend
 * or Withdraw — a plain Editor can only propose one. */
export function canRatifyModeration(role: Role): boolean {
  return role === "ADMIN" || role === "CHIEF_EDITOR";
}
