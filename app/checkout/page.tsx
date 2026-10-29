import { CheckoutClient } from "./CheckoutClient";
import type { CartItem } from "@/hooks/useCart";

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
