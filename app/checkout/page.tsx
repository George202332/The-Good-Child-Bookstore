import { CheckoutClient } from "./CheckoutClient";
import type { CartItem } from "@/hooks/useCart";

// The pay buttons run the order check, Lulu's price lookup and the gateway start-up as server actions of this page:
// give them room (the checkout itself stops waiting after 30 seconds and shows a clear message).
export const maxDuration = 60;

const FORMATS = ["ebook", "paperback", "hardcover", "audiobook"];

/** Reads the few address-bar values checkout uses on the server and passes them in. */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  const directFormat = one(sp.directFormat);
  return (
    <CheckoutClient
      directBookId={one(sp.directBookId)}
      directFormat={directFormat && FORMATS.includes(directFormat) ? (directFormat as CartItem["format"]) : null}
      paymentFailed={one(sp.payment_failed) === "1"}
    />
  );
}
