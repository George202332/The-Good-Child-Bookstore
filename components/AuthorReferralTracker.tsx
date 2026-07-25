"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { recordAuthorReferralVisit } from "@/actions/affiliate-referral";

/** Fires recordAuthorReferralVisit() once per page load when the author
 * signup page is visited via ?ref=<affiliate referral code>. Renders
 * nothing — same pattern as AffiliateClickTracker, for author-recruitment
 * links instead of per-book promotional links. */
export function AuthorReferralTracker() {
  const searchParams = useSearchParams();
  const code = searchParams.get("ref");
  const fired = useRef(false);

  useEffect(() => {
    if (code && !fired.current) {
      fired.current = true;
      recordAuthorReferralVisit(code);
    }
  }, [code]);

  return null;
}
