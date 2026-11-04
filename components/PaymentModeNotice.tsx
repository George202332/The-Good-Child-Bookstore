import { getPaymentSafety } from "@/lib/api-keys";
import { deploymentLabel, describeDatabase } from "@/lib/runtime-env";

/** A small strip shown to the ADMIN only (never to editors, accountants or customers). It shows which copy of the site this is,
 * which payment mode is active, which database the site is connected to (endpoint NAME only, never a password) and, in red at
 * the top, any safeguard that has switched a payment method off. Never shows a key. */
export async function PaymentModeNotice() {
  let safety;
  try {
    safety = await getPaymentSafety();
  } catch {
    return null;
  }
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  const set = safety.set;
  const warnings = [safety.paystack, safety.paypal].filter((s) => s.safeguard && s.reason);
  const colour = warnings.length ? "#a1262a" : set === "live" ? "#165236" : "#8a5a00";
  const heading = set === "live" ? "Live payments - real money" : "Test mode - no real money";
  const state = (s: { allowed: boolean; safeguard: boolean }) => (s.allowed ? set.toUpperCase() : s.safeguard ? "SWITCHED OFF" : "not set up");
  return (
    <>
      {warnings.length > 0 && (
        <div role="alert" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 80, background: "#a1262a", color: "#fff", padding: "8px 14px", fontSize: 13, lineHeight: 1.4 }}>
          <strong>Payment safeguard:</strong> {warnings.map((w) => w.reason).join(" ")}
        </div>
      )}
      <div
        role="status"
        style={{ position: "fixed", right: 12, bottom: 12, zIndex: 60, maxWidth: "calc(100vw - 24px)", background: "#fff", color: colour, border: `1.5px solid ${colour}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, lineHeight: 1.35, boxShadow: "0 2px 10px rgba(0,0,0,.18)" }}
      >
        <strong>{heading}</strong>
        <div>Paystack: {state(safety.paystack)} · PayPal: {state(safety.paypal)}</div>
        <div style={{ color: "#555", marginTop: 2 }}>
          {deploymentLabel(safety.deployment)}
          {db ? ` · Database: ${db.label ? `${db.label} - ` : ""}${db.endpoint}${db.database ? ` / ${db.database}` : ""}` : " · Database: not set"}
        </div>
      </div>
    </>
  );
}
