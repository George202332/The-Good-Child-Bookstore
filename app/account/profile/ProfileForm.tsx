"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfile, type MyProfile } from "@/actions/profile";

const AGE_RANGES = ["0-2", "3-5", "6-8", "9-12", "12-15"];

export function ProfileForm({ initial }: { initial: MyProfile }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [penName, setPenName] = useState(initial.penName ?? "");
  const [primaryGenre, setPrimaryGenre] = useState(initial.primaryGenre ?? "");
  const [pressKitUrl, setPressKitUrl] = useState(initial.pressKitUrl ?? "");
  const [availableForCollabs, setAvailableForCollabs] = useState(initial.availableForCollabs ?? false);
  const [showEmailPublicly, setShowEmailPublicly] = useState(initial.showEmailPublicly ?? false);
  const [preferredFormat, setPreferredFormat] = useState(initial.preferredFormat ?? "");
  const [shoppingAges, setShoppingAges] = useState<string[]>(initial.shoppingForAgeRanges ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggleAge(age: string) {
    setShoppingAges((cur) => (cur.includes(age) ? cur.filter((a) => a !== age) : [...cur, age]));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const res = await updateMyProfile({
      name, email, bio, penName, primaryGenre, pressKitUrl, availableForCollabs, showEmailPublicly,
      preferredFormat, shoppingForAgeRanges: shoppingAges,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="form-section" style={{ maxWidth: 640 }}>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="pf-name">Full name</label>
          <input className="field" id="pf-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="pf-email">Email</label>
          <input className="field" id="pf-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      {initial.role === "AUTHOR" && (
        <>
          <h3 style={{ fontSize: 15, margin: "16px 0 10px" }}>Author details</h3>
          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor="pf-penname">Pen name</label>
              <input className="field" id="pf-penname" type="text" value={penName} onChange={(e) => setPenName(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="pf-genre">Primary genre</label>
              <input className="field" id="pf-genre" type="text" value={primaryGenre} onChange={(e) => setPrimaryGenre(e.target.value)} />
            </div>
          </div>
          <label className="field-label" htmlFor="pf-bio">Author bio</label>
          <textarea className="field" id="pf-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          <label className="field-label" htmlFor="pf-presskit">Press kit URL</label>
          <input className="field" id="pf-presskit" type="url" value={pressKitUrl} onChange={(e) => setPressKitUrl(e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, marginBottom: 10 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={availableForCollabs} onChange={(e) => setAvailableForCollabs(e.target.checked)} /> Available for collaborations
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={showEmailPublicly} onChange={(e) => setShowEmailPublicly(e.target.checked)} /> Show my email publicly on my author page
          </label>
        </>
      )}

      {initial.role === "READER" && (
        <>
          <h3 style={{ fontSize: 15, margin: "16px 0 10px" }}>Reading preferences</h3>
          <label className="field-label" htmlFor="pf-format">Preferred format</label>
          <select className="field" id="pf-format" value={preferredFormat} onChange={(e) => setPreferredFormat(e.target.value)}>
            <option value="">No preference</option>
            <option value="EBOOK">eBook</option>
            <option value="PRINT">Print</option>
            <option value="AUDIOBOOK">Audiobook</option>
          </select>
          <label className="field-label">Shopping for age ranges</label>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
            {AGE_RANGES.map((a) => (
              <label key={a} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={shoppingAges.includes(a)} onChange={() => toggleAge(a)} /> {a} years
              </label>
            ))}
          </div>
        </>
      )}

      {initial.role === "AFFILIATE" && initial.referralCode && (
        <>
          <h3 style={{ fontSize: 15, margin: "16px 0 10px" }}>Affiliate details</h3>
          <div className="field-hint">Your referral code: <strong>{initial.referralCode}</strong></div>
        </>
      )}

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting} style={{ marginTop: 10 }}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
