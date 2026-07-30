import { redirect } from "next/navigation";

/** Affiliate is no longer a separate account type — every Author
 * account already has full affiliate capability built in. This route
 * just forwards to the Author signup so any existing links/bookmarks
 * still work. */
export default function SignupAffiliateRedirectPage() {
  redirect("/signup/author");
}
