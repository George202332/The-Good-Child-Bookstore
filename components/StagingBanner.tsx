import { deploymentOf } from "@/lib/runtime-env";

/** A bright bar at the very top of every page, shown only when the site runs as staging (Vercel Preview). Never on the live site. */
export function StagingBanner() {
  if (deploymentOf() !== "preview") return null;
  return (
    <div
      role="note"
      style={{ position: "sticky", top: 0, zIndex: 9999, background: "#f4b942", color: "#2b2100", textAlign: "center", fontWeight: 700, fontSize: 13, letterSpacing: 0.3, padding: "6px 12px", borderBottom: "2px solid #2b2100" }}
    >
      STAGING - this is a test copy of the site. No real money, emails or print orders.
    </div>
  );
}
