/**
 * Sidebar nav icons — one small stroke icon per dashboard nav item key,
 * rendered before the label in DashboardShell.tsx. Kept in their own
 * map (rather than inline) so adding a new nav item without a matching
 * key here just renders no icon, instead of breaking anything.
 */

import type { ReactElement } from "react";

const ICON_PROPS = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const NAV_ICONS: Record<string, ReactElement> = {
  dashboard: (
    <svg {...ICON_PROPS}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
  ),
  profile: (
    <svg {...ICON_PROPS}><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.7-4 3.4-6.2 7-6.2s6.3 2.2 7 6.2" /></svg>
  ),
  messages: (
    <svg {...ICON_PROPS}><path d="M4 5h16v11H8l-4 4V5Z" /></svg>
  ),
  security: (
    <svg {...ICON_PROPS}><path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3Z" /></svg>
  ),
  settings: (
    <svg {...ICON_PROPS}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.2.7.7 1.2 1.5 1.4h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
  ),
  library: (
    <svg {...ICON_PROPS}><path d="M4 4h4v17H4z" /><path d="M10 4h4v17h-4z" /><path d="M16.5 5l3.7 16.5-3.9.9L12.6 5.9z" /></svg>
  ),
  wishlist: (
    <svg {...ICON_PROPS}><path d="M12 20C12 20 4 15.3 4 9.6 4 6.8 6.1 4.7 8.8 4.7c1.6 0 3 .8 3.2 1 .2-.2 1.6-1 3.2-1 2.7 0 4.8 2.1 4.8 4.9 0 5.7-8 10.4-8 10.4Z" /></svg>
  ),
  orders: (
    <svg {...ICON_PROPS}><path d="M3 8l9-5 9 5-9 5-9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>
  ),
  addresses: (
    <svg {...ICON_PROPS}><path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
  ),
  "payment-methods": (
    <svg {...ICON_PROPS}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 9.5h19" /></svg>
  ),
  following: (
    <svg {...ICON_PROPS}><circle cx="9.5" cy="8.5" r="3.3" /><path d="M3.5 19.5c.6-3.6 3-5.6 6-5.6s5.4 2 6 5.6" /><path d="M18 8h3M19.5 6.5v3" /></svg>
  ),
  reviews: (
    <svg {...ICON_PROPS}><path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.5Z" /></svg>
  ),
  referrals: (
    <svg {...ICON_PROPS}><path d="M9 15l6-6" /><path d="M10 6.5h-.5A4.5 4.5 0 0 0 5 11v.5" /><path d="M14 17.5h.5A4.5 4.5 0 0 0 19 13v-.5" /><path d="M6 3.5l-1.5 2L7 7" /><path d="M18 20.5l1.5-2-2.5-1.5" /></svg>
  ),
  class: (
    <svg {...ICON_PROPS}><path d="M8 3h8l-1 6-3 3-3-3-1-6Z" /><path d="M9 12v3l-3 5h12l-3-5v-3" /></svg>
  ),
  "active-campaigns": (
    <svg {...ICON_PROPS}><path d="M3 10v4h3l5 4V6L6 10H3Z" /><path d="M15 9a4 4 0 0 1 0 6" /><path d="M17.5 6.5a8 8 0 0 1 0 11" /></svg>
  ),
  promotions: (
    <svg {...ICON_PROPS}><path d="M3 10v4h3l5 4V6L6 10H3Z" /><path d="M15 9a4 4 0 0 1 0 6" /><path d="M17.5 6.5a8 8 0 0 1 0 11" /></svg>
  ),
  resources: (
    <svg {...ICON_PROPS}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
  ),
  campaigns: (
    <svg {...ICON_PROPS}><path d="M3 10v4h3l5 4V6L6 10H3Z" /><path d="M15 9a4 4 0 0 1 0 6" /></svg>
  ),
  commissions: (
    <svg {...ICON_PROPS}><circle cx="7" cy="7" r="2.6" /><circle cx="17" cy="17" r="2.6" /><path d="M18 6L6 18" /></svg>
  ),
  earnings: (
    <svg {...ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M14.8 9.3c0-1.3-1.2-2-2.8-2s-2.8.8-2.8 2 1.2 1.7 2.8 2 2.8.7 2.8 2-1.2 2-2.8 2-2.8-.7-2.8-2" /></svg>
  ),
  performance: (
    <svg {...ICON_PROPS}><path d="M4 20V10M11 20V4M18 20v-7" /></svg>
  ),
  payments: (
    <svg {...ICON_PROPS}><path d="M3 7.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z" /><path d="M3 10.5h18" /><path d="M6 15.5h4" /></svg>
  ),
  "payout-settings": (
    <svg {...ICON_PROPS}><path d="M3 10l9-6 9 6" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></svg>
  ),
  mybooks: (
    <svg {...ICON_PROPS}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 17.5h15" /></svg>
  ),
  blog: (
    <svg {...ICON_PROPS}><path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20Z" /><path d="M13.5 6.5L17 10" /></svg>
  ),
  analytics: (
    <svg {...ICON_PROPS}><path d="M4 19V5M4 19h16" /><path d="M8 15l3.5-4 3 2.5L19 9" /></svg>
  ),
  "blog-analytics": (
    <svg {...ICON_PROPS}><path d="M4 19V5M4 19h16" /><path d="M8 15l3.5-4 3 2.5L19 9" /></svg>
  ),
  "affiliate-analytics": (
    <svg {...ICON_PROPS}><path d="M4 20V10M11 20V4M18 20v-7" /></svg>
  ),
  revenue: (
    <svg {...ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M14.8 9.3c0-1.3-1.2-2-2.8-2s-2.8.8-2.8 2 1.2 1.7 2.8 2 2.8.7 2.8 2-1.2 2-2.8 2-2.8-.7-2.8-2" /></svg>
  ),
  "transaction-history": (
    <svg {...ICON_PROPS}><path d="M6 3.5h9l4 4v13H6Z" /><path d="M9.5 11h6M9.5 14.5h6M9.5 18h4" /></svg>
  ),
};
