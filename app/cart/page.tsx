import { redirect } from "next/navigation";

/**
 * Merged into /checkout (whose Step 1 is a full cart review — wider
 * layout, digital-aware formatting, no phantom shipping line for
 * digital items) per explicit instruction: there were two separate,
 * inconsistently-behaving cart pages (this one, and Step 1 of
 * checkout), which is exactly what was causing "the checkout process
 * twice" confusion. Now there's one single flow.
 */
export default function CartRedirectPage() {
  redirect("/checkout");
}
