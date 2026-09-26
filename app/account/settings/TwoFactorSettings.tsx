"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PasswordField } from "@/components/PasswordField";
import {
  startMyTwoFactorSetup,
  confirmMyTwoFactorSetup,
  disableMyTwoFactor,
} from "@/actions/two-factor";
import type { TwoFactorMethod, TwoFactorStatus } from "@/lib/two-factor";

type View = "status" | "choose-method" | "enter-phone" | "verify-setup" | "disable";

/**
 * Security / 2FA — added inside the existing Settings page, right
 * below Change password, for both Reader and Author (same component,
 * no role-specific behavior needed). Does not redesign Settings at
 * all — just one more map-card section, matching AffiliateToggle's
 * and ChangePasswordForm's existing visual pattern.
 */
export function TwoFactorSettings({ initial }: { initial: TwoFactorStatus }) {
  const router = useRouter();
  const { update } = useSession();
  const [status, setStatus] = useState(initial);
  const [view, setView] = useState<View>("status");
  const [method, setMethod] = useState<TwoFactorMethod>("EMAIL");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleStart() {
    setBusy(true);
    setError(null);
    const res = await startMyTwoFactorSetup(method, method === "SMS" ? phone : null);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    setInfo(`We sent a 6-digit code ${method === "SMS" ? "to your phone" : "to your email"} — enter it below to finish turning on 2FA.`);
    setView("verify-setup");
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await confirmMyTwoFactorSetup(code);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Incorrect code."); return; }
    // This session already just proved the second factor, so it's
    // marked as already-satisfied — only the NEXT sign-in will be
    // asked for a code again.
    await update({ twoFactorEnabled: true, twoFactorVerified: true });
    setStatus({ enabled: true, method, maskedDestination: null, pendingMethod: null, pendingMaskedDestination: null });
    setCode("");
    setInfo("Two-factor authentication is now on.");
    setView("status");
    router.refresh();
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await disableMyTwoFactor(password);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    await update({ twoFactorEnabled: false, twoFactorVerified: true });
    setStatus({ enabled: false, method: null, maskedDestination: null, pendingMethod: null, pendingMaskedDestination: null });
    setPassword("");
    setInfo("Two-factor authentication has been turned off.");
    setView("status");
    router.refresh();
  }

  return (
    <div className="map-card" style={{ padding: 24, marginTop: 20 }}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Two-factor authentication</h3>
      <p className="field-hint" style={{ margin: "0 0 16px" }}>
        Adds a second step at login — a 6-digit code sent to your email or phone, in addition to your password.
      </p>

      {info && <p style={{ color: "#1F6B48", fontSize: 13, marginBottom: 12 }}>{info}</p>}
      {error && <p style={{ color: "var(--coral-deep)", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {view === "status" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <strong>{status.enabled ? "On" : "Off"}</strong>
            {status.enabled && (
              <span style={{ color: "var(--ink-soft)", fontSize: 13, marginLeft: 8 }}>
                via {status.method === "SMS" ? "text message" : "email"}
              </span>
            )}
          </div>
          {status.enabled ? (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => { setError(null); setInfo(null); setView("disable"); }}>
              Turn off
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-small" onClick={() => { setError(null); setInfo(null); setView("choose-method"); }}>
              Set up 2FA
            </button>
          )}
        </div>
      )}

      {view === "choose-method" && (
        <div>
          <label className="field-label">Choose a method</label>
          <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 400 }}>
              <input type="radio" name="tfa-method" checked={method === "EMAIL"} onChange={() => setMethod("EMAIL")} /> Email
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 400 }}>
              <input type="radio" name="tfa-method" checked={method === "SMS"} onChange={() => setMethod("SMS")} /> Phone (SMS)
            </label>
          </div>
          {method === "SMS" ? (
            <>
              <label className="field-label" htmlFor="tfa-phone">Phone number</label>
              <input className="field" id="tfa-phone" type="tel" placeholder="+15551234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="field-hint" style={{ margin: "0 0 14px" }}>Include your country code, e.g. +254 for Kenya.</p>
            </>
          ) : (
            <p className="field-hint" style={{ margin: "0 0 14px" }}>Codes will be sent to your account email address.</p>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setView("status")}>Cancel</button>
            <button type="button" className="btn btn-primary btn-small" disabled={busy || (method === "SMS" && !phone.trim())} onClick={handleStart}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </div>
        </div>
      )}

      {view === "verify-setup" && (
        <form onSubmit={handleConfirm}>
          <label className="field-label" htmlFor="tfa-setup-code">Enter the 6-digit code</label>
          <input
            className="field"
            id="tfa-setup-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ maxWidth: 160, textAlign: "center", fontSize: 18, letterSpacing: 3 }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setView("choose-method")}>Back</button>
            <button type="submit" className="btn btn-primary btn-small" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Confirm and turn on"}
            </button>
          </div>
        </form>
      )}

      {view === "disable" && (
        <form onSubmit={handleDisable}>
          <label className="field-label" htmlFor="tfa-disable-password">Confirm your password to turn off 2FA</label>
          <PasswordField id="tfa-disable-password" name="tfa-disable-password" required value={password} onChange={setPassword} autoComplete="current-password" />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => { setPassword(""); setView("status"); }}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-small" disabled={busy || !password}>
              {busy ? "Working…" : "Turn off 2FA"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
