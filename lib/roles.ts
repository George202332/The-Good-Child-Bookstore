/**
 * ROLE MODEL
 *
 * Confirmed with the project owner:
 *   - READER, AUTHOR, AFFILIATE are the existing public-facing roles,
 *     converted pixel-for-pixel from the original frontend.
 *   - EDITOR, ADMIN are new, backend/internal-only roles with no matching
 *     UI in the original frontend — their dashboards and the editorial
 *     approval workflow are being built fresh per the project brief.
 */

export type Role = "READER" | "AUTHOR" | "AFFILIATE" | "EDITOR" | "ADMIN";

export const FRONTEND_ROLES: Role[] = ["READER", "AUTHOR", "AFFILIATE"];
export const BACKEND_ROLES: Role[] = ["EDITOR", "ADMIN"];

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

/** EDITOR cannot see financial information — explicit per the brief. */
export function canViewFinancials(role: Role): boolean {
  return role === "ADMIN" || role === "AUTHOR" || role === "AFFILIATE";
}
