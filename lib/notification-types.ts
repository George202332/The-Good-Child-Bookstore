export type NotificationType =
  | "PAYMENT"
  | "PAYOUT"
  | "BOOK_PUBLISHED"
  | "REVISION"
  | "BLOG_PUBLISHED"
  | "BLOG_REVISION"
  | "MESSAGE"
  | "GENERAL";

export interface NotificationTypeInfo {
  color: string;
  iconPath: string; // SVG path data, rendered inside a 24x24 viewBox
  /** Which sidebar nav item (see components/DashboardShell.tsx's
   * navItemsForRole keys) should blink when this type has an unread
   * notification, and gets marked read once that section is visited.
   * null = no sidebar item to target (still shows in Recent Activity). */
  sidebarKey: string | null;
}

export const NOTIFICATION_TYPES: Record<NotificationType, NotificationTypeInfo> = {
  PAYMENT: {
    color: "#1F6B48", // green
    iconPath: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    sidebarKey: "revenue",
  },
  PAYOUT: {
    color: "#2451B7", // blue
    iconPath: "M3 10h18M7 15h2M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
    sidebarKey: "payout-settings",
  },
  BOOK_PUBLISHED: {
    color: "#6B3FA0", // purple
    iconPath: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
    sidebarKey: "mybooks",
  },
  REVISION: {
    color: "#B7472A", // red
    iconPath: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2zM9 8h6M9 12h4",
    sidebarKey: "mybooks",
  },
  BLOG_PUBLISHED: {
    color: "#6B3FA0", // purple
    iconPath: "M4 6h16v12H4zM4 7l8 6 8-6",
    sidebarKey: "blog",
  },
  BLOG_REVISION: {
    color: "#B7472A", // red
    iconPath: "M4 6h16v12H4zM4 7l8 6 8-6",
    sidebarKey: "blog",
  },
  MESSAGE: {
    color: "#2451B7", // blue
    iconPath: "M4 6h16v12H4zM4 7l8 6 8-6",
    sidebarKey: "messages",
  },
  GENERAL: {
    color: "#6F6386",
    iconPath: "M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2Zm6-6v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z",
    sidebarKey: null,
  },
};

export function notificationTypeInfo(type: string): NotificationTypeInfo {
  return NOTIFICATION_TYPES[type as NotificationType] ?? NOTIFICATION_TYPES.GENERAL;
}
