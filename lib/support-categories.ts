/**
 * The fixed list of issue categories a reader/author picks from when
 * contacting Support (see app/account/messages/ComposeMessageForm.tsx)
 * and that the admin backend's Messages tab shows on each thread (see
 * app/admin/messages/AdminMessagesList.tsx and AdminThreadView.tsx).
 *
 * Deliberately NOT defined inside actions/messages.ts or
 * actions/admin-messages.ts even though both use it: those are
 * "use server" files, and Next.js only allows a "use server" file to
 * export async functions — exporting a plain constant like this one
 * from either of them (as an earlier version of this code did) breaks
 * the build with "A 'use server' file can only export async functions,
 * found object." Any client component that needs this list imports it
 * from here instead, and the server action files import it from here
 * too for their own internal use (still fine — they just don't
 * re-export it).
 */
export const SUPPORT_CATEGORIES = [
  { key: "ACCOUNT", label: "Account" },
  { key: "PAYMENTS", label: "Payments" },
  { key: "TECHNICAL", label: "Technical" },
  { key: "CONTENT", label: "Content" },
  { key: "OTHER", label: "Other" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["key"];
