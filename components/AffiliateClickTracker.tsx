"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { recordAffiliateClick } from "@/actions/affiliate";

/** Fires recordAffiliateClick() once per page load when a book page is
 * visited via ?aff=<code> (see actions/affiliate.ts). Renders nothing. */
export function AffiliateClickTracker() {
  const searchParams = useSearchParams();
  const code = searchParams.get("aff");
  const fired = useRef(false);

  useEffect(() => {
    if (code && !fired.current) {
      fired.current = true;
      recordAffiliateClick(code);
    }
  }, [code]);

  return null;
}
