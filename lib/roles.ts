/**
 * ROLE MODEL
 *
 * Confirmed with the project owner:
 *   - READER, AUTHOR, AFFILIATE are the existing public-facing roles,
 *     converted pixel-for-pixel from the original frontend.
 *   - EDITOR, ADMIN, ACCOUNTANT are new, backend/internal-only roles with
 *     no matching UI in the original frontend. EDITOR handles book/blog
 *     moderation (approve, send back for revision). ACCOUNTANT is
 *     read-only access to all financial data (transactions, revenue
 *     breakdowns, payouts) with no ability to moderate content or manage
 *     users/site settings — added per explicit request for a role that
 *     "fetches all accounting information" without broader admin power.
 */

export type Role = "READER" | "AUTHOR" | "AFFILIATE" | "EDITOR" | "ADMIN" | "ACCOUNTANT";

export const FRONTEND_ROLES: Role[] = ["READER", "AUTHOR", "AFFILIATE"];
export const BACKEND_ROLES: Role[] = ["EDITOR", "ADMIN", "ACCOUNTANT"];

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
  ],
  AFFILIATE: [
    "referralLinks:generate",
    "commissions:view",
    "payouts:request",
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

/** EDITOR cannot see financial information — explicit per the brief.
 * ACCOUNTANT exists specifically to see financial information. */
export function canViewFinancials(role: Role): boolean {
  return role === "ADMIN" || role === "AUTHOR" || role === "AFFILIATE" || role === "ACCOUNTANT";
}

/** ACCOUNTANT can view the financial admin pages (Transactions, Analytics,
 * Payouts) but cannot moderate books/blogs, manage users, or edit site
 * content — narrower than ADMIN, distinct from EDITOR's moderation-only
 * scope. */
export function canModerateContent(role: Role): boolean {
  return role === "ADMIN" || role === "EDITOR";
}
