import { redirect } from "next/navigation";

/** Merged into /account/active-campaigns (Promotions) per redesign —
 * this route just forwards there now so any existing links/bookmarks
 * still work. */
export default function PromotionsRedirectPage() {
  redirect("/account/active-campaigns");
}
