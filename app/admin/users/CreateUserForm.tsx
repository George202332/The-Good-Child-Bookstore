"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserAccount } from "@/actions/users-admin";
import type { Role } from "@/lib/roles";
import { PasswordField } from "@/components/PasswordField";

const ROLES: Role[] = ["READER", "AUTHOR", "AFFILIATE", "EDITOR", "ADMIN", "ACCOUNTANT"];

export function CreateUserForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("READER");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const res = await createUserAccount({ name, email, password, role });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSuccess(`Created ${role} account for ${email}.`);
    setName("");
    setEmail("");
    setPassword("");
    setRole("READER");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="form-section" style={{ marginBottom: 24 }}>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="cu-name">Full name</label>
          <input className="field" id="cu-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="cu-role">Account type</label>
          <select className="field" id="cu-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="cu-email">Email</label>
          <input className="field" id="cu-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="cu-password">Password</label>
          <PasswordField id="cu-password" required minLength={6} value={password} onChange={setPassword} />
        </div>
      </div>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {success && <div className="field-hint" style={{ color: "#1F6B48" }}>{success}</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
