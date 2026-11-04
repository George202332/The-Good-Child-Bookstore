import { deploymentOf } from "@/lib/runtime-env";
import { getMigrationStatus, migrationWarning } from "@/lib/migration-status";

/** A bright bar at the very top of every page, shown only when the site runs as staging (Vercel Preview). Never on the live site.
 * If the staging database is behind the code (a migration was not applied), a red line says so, so it is seen before testing. */
export async function StagingBanner() {
  if (deploymentOf() !== "preview") return null;
  const warning = migrationWarning(await getMigrationStatus().catch(() => ({ checked: false, expectedCount: 0, appliedCount: 0, missing: [], failed: [], behind: false })));
  return (
    <div role="note" style={{ position: "sticky", top: 0, zIndex: 9999 }}>
      <div style={{ background: "#f4b942", color: "#2b2100", textAlign: "center", fontWeight: 700, fontSize: 13, letterSpacing: 0.3, padding: "6px 12px", borderBottom: "2px solid #2b2100" }}>
        STAGING - this is a test copy of the site. No real money, emails or print orders.
      </div>
      {warning && (
        <div role="alert" style={{ background: "#a1262a", color: "#fff", textAlign: "center", fontSize: 13, padding: "6px 12px" }}>{warning}</div>
      )}
    </div>
  );
}
