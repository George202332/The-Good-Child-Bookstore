import type { UserAdminProfile, AdminPayoutRecipient } from "@/actions/users-admin-details";

/**
 * Extra, read-only sections on the admin user detail page: account
 * information and payments / banking details. Rendered only from the
 * ADMIN-gated page, and the data comes from getUserAdminProfile, which
 * itself returns nothing for non-admins. Server component, no bold text.
 */

const NOT_PROVIDED = "Not provided";

const CARD: React.CSSProperties = { padding: 20, marginBottom: 20 };
const HEADING: React.CSSProperties = { fontSize: 16, fontWeight: 400, marginBottom: 4 };
const SUBTEXT: React.CSSProperties = { fontSize: 12.5, color: "var(--admin-text-faint)", marginBottom: 14 };
const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", columnGap: 24 };

function Row({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--admin-border)" }}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--admin-text-faint)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: value ? "var(--admin-text)" : "var(--admin-text-faint)", wordBreak: "break-word" }}>{value ?? NOT_PROVIDED}</div>
      {note && <div style={{ fontSize: 11.5, color: "var(--admin-text-faint)", marginTop: 2 }}>{note}</div>}
    </div>
  );
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function sameName(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
}

function RecipientBlock({ r, accountName, prominent }: { r: AdminPayoutRecipient; accountName: string; prominent: boolean }) {
  const differs = !sameName(r.accountHolderName, accountName);
  return (
    <div
      style={{
        border: prominent ? "1px solid var(--admin-accent)" : "1px solid var(--admin-border)",
        borderRadius: 12,
        padding: "12px 16px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 14, color: "var(--admin-text)" }}>{r.methodLabel}</span>
        {r.isDefault && <span className="age-pill">Default payout method</span>}
      </div>
      <div style={GRID}>
        <Row label="Bank name" value={r.bankName} />
        <Row
          label="Account holder name (on the payout account)"
          value={r.accountHolderName || null}
          note={differs ? `Differs from the account name: ${accountName}` : "Matches the account name"}
        />
        <Row label="Account number" value={r.accountNumber} />
        <Row label="SWIFT code / routing number" value={r.swiftOrRouting} />
        <Row label="Intermediary bank (for international wires)" value={r.intermediaryBank} />
        <Row label="Country" value={r.country} />
        <Row label="Preferred payout currency" value={r.currency || null} />
        {r.type === "email" && <Row label="PayPal email" value={r.paypalEmail} />}
        {r.type === "mpesa" && <Row label="M-Pesa phone number" value={r.mpesaPhone} />}
      </div>
      {r.rawDetails !== "—" && !r.bankName && !r.accountNumber && r.type !== "email" && r.type !== "mpesa" && (
        <Row label="Other stored details" value={r.rawDetails} />
      )}
    </div>
  );
}

export function UserAdminDetails({ profile, country }: { profile: UserAdminProfile; country: { name: string | null; source: string | null } }) {
  const defaultRecipient = profile.recipients.find((r) => r.isDefault) ?? null;
  const others = profile.recipients.filter((r) => r !== defaultRecipient);

  return (
    <>
      <div className="map-card" style={CARD}>
        <h3 style={HEADING}>Account information</h3>
        <p style={SUBTEXT}>Identity details held for this account.</p>
        <div style={GRID}>
          <Row label="Account ID" value={profile.accountNumber} />
          <Row label="Internal ID" value={profile.internalId} />
          <Row label="Full name (name on the account)" value={profile.name} />
          <Row label="First name" value={profile.firstName} note="Derived from the account name (only one name field is stored)" />
          <Row label="Last name" value={profile.lastName} note="Derived from the account name (only one name field is stored)" />
          <Row label="Email" value={profile.email} />
          <Row
            label="Email verification"
            value={profile.emailVerifiedAt ? `Verified on ${fmtDate(profile.emailVerifiedAt)}` : "Not verified"}
          />
          <Row label="Country" value={country.name ?? "Not collected"} note={country.source ? `Source: ${country.source}` : undefined} />
          {profile.phones.length === 0 ? (
            <Row label="Phone number" value={null} />
          ) : (
            profile.phones.map((p, i) => <Row key={`${p.label}-${i}`} label={`Phone number (${p.label})`} value={p.value} />)
          )}
        </div>
      </div>

      <div className="map-card" style={CARD}>
        <h3 style={HEADING}>Payments / Banking Details</h3>
        <p style={SUBTEXT}>Payout destinations this user saved. Visible to admins only.</p>
        {profile.recipients.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--admin-text-faint)" }}>No payout details on file.</p>
        ) : (
          <>
            {defaultRecipient ? (
              <RecipientBlock r={defaultRecipient} accountName={profile.name} prominent />
            ) : (
              <p style={{ fontSize: 13, color: "var(--admin-text-faint)", marginBottom: 12 }}>No default payout method is set.</p>
            )}
            {others.length > 0 && (
              <>
                <p style={{ ...SUBTEXT, marginTop: 8 }}>Additional payout methods</p>
                {others.map((r) => (
                  <RecipientBlock key={r.id} r={r} accountName={profile.name} prominent={false} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
