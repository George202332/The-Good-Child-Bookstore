import { redirect } from "next/navigation";

/** Renamed to /account/transactions, to match the sidebar label exactly
 * — this route just forwards there now so any existing links/bookmarks
 * still work. */
export default function MyTransactionsRedirectPage() {
  redirect("/account/transactions");
}
