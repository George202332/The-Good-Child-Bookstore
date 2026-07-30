"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserDetail, toggleUserSuspension, deleteUserAccount } from "@/actions/users-admin";
import type { UserDetail } from "@/actions/users-admin";

export function EditUserForm({ user, isSelf }: { user: UserDetail; isSelf: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [authorBio, setAuthorBio] = useState(user.authorBio ?? "");
  const [authorPrimaryGenre, setAuthorPrimaryGenre] = useState(user.authorPrimaryGenre ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const res = await updateUserDetail(user.id, { name, email, authorBio, authorPrimaryGenre });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function handleSuspendToggle() {
    const res = await toggleUserSuspension(user.id);
    if (!res.ok) {
      setError(res.error ?? "Failed");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this account permanently? This cannot be undone.")) return;
    const res = await deleteUserAccount(user.id);
    if (!res.ok) {
      setError(res.error ?? "Failed");
      return;
    }
    router.push("/admin/users");
  }

  return (
    <>
      <form onSubmit={handleSave} className="form-section" style={{ marginBottom: 20 }}>
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="edit-name">Full name</label>
            <input className="field" id="edit-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="edit-email">Email</label>
            <input className="field" id="edit-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        {user.role === "AUTHOR" && (
          <>
            <label className="field-label" htmlFor="edit-bio">Author bio</label>
            <textarea className="field" id="edit-bio" rows={3} value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} />
            <label className="field-label" htmlFor="edit-genre">Primary genre</label>
            <input className="field" id="edit-genre" type="text" value={authorPrimaryGenre} onChange={(e) => setAuthorPrimaryGenre(e.target.value)} />
          </>
        )}

        {user.role === "AUTHOR" && user.affiliateReferralCode && (
          <div className="field-hint" style={{ marginBottom: 12 }}>Referral code: <strong>{user.affiliateReferralCode}</strong></div>
        )}

        {error && <div className="field-hint" style={{ color: "var(--coral-deep, var(--admin-danger))" }}>{error}</div>}
        {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved.</div>}
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </form>

      {!isSelf && (
        <div className="form-section" style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-ghost btn-small" onClick={handleSuspendToggle}>
            {user.suspended ? "Reactivate account" : "Suspend account"}
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={handleDelete}>
            Delete account
          </button>
        </div>
      )}
    </>
  );
}
