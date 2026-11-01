/**
 * What the checkout shows for shipping, decided from what Lulu answered. Pure, so the rules are tested.
 *
 *   ok           Lulu priced this address: its methods and exact prices are shown.
 *   incomplete   The address (or country) is not complete yet: the store's estimate is shown, labelled as one.
 *   cannot-ship  Lulu answered that it cannot ship these books to this address, or none of the methods it offers is
 *                switched on for this store: a clear message, and nothing to pick.
 *   unavailable  Lulu could not be asked right now: a clear message to try again, and nothing to pick. (An estimate is
 *                never charged, so none is offered here.)
 */
export type ShippingState = "ok" | "incomplete" | "cannot-ship" | "unavailable" | "price-unavailable" | "none";
// "price-unavailable": Lulu can ship to this address, but its printing price (cost calculator) could not be confirmed
// for this order, so nothing is offered and the customer is told exactly why (see lib/lulu-quote-failure.ts).

export function shippingOutcome(opts: { lulu: "ok" | "none" | "error" | "incomplete"; offered: number; countryName: string }): { state: ShippingState; message?: string } {
  const where = opts.countryName ? `to ${opts.countryName}` : "to this address";
  if (opts.lulu === "incomplete") return { state: "incomplete" };
  if (opts.lulu === "error") {
    return { state: "unavailable", message: "We could not get shipping prices from our print partner just now. Please wait a moment and check your address again; nothing has been charged." };
  }
  if (opts.lulu === "none" || opts.offered === 0) {
    return { state: "cannot-ship", message: `Our print partner cannot ship this printed book ${where}. Please check the country and postal code. If they are right, you can remove the printed copy from your cart and buy the eBook or audiobook instead.` };
  }
  return { state: "ok" };
}
