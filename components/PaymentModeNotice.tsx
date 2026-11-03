import { getPaymentModes } from "@/lib/api-keys";

/** A small strip shown to the ADMIN only (never to editors, accountants or customers) so it is always clear which
 * payment mode is active. Shows names of modes only, never any key. */
export async function PaymentModeNotice() {
  let modes;
  try {
    modes = await getPaymentModes();
  } catch {
    return null;
  }
  const live = modes.paystack.mode === "live" && modes.paypal.mode === "live";
  const test = modes.paystack.mode === "test" && modes.paypal.mode === "sandbox";
  const label = (name: string, on: boolean) => `${name}: ${on ? "LIVE" : "TEST"}`;
  const text = `${label("Paystack", modes.paystack.mode === "live")} · ${label("PayPal", modes.paypal.mode === "live")}`;
  const colour = live ? "#165236" : test ? "#8a5a00" : "#a1262a";
  const heading = live ? "Live payments - real money" : test ? "Test mode - no real money" : "Mixed mode - check your payment settings";
  return (
    <div
      role="status"
      style={{ position: "fixed", right: 12, bottom: 12, zIndex: 60, maxWidth: "calc(100vw - 24px)", background: "#fff", color: colour, border: `1.5px solid ${colour}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, lineHeight: 1.35, boxShadow: "0 2px 10px rgba(0,0,0,.18)" }}
    >
      <strong>{heading}</strong>
      <div>{text}</div>
    </div>
  );
}
