"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSiteDataMode } from "@/actions/test-data";

export function SiteModeToggle({ currentMode }: { currentMode: "live" | "test" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingMode, setConfirmingMode] = useState<"live" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (!confirmingMode) return;
    startTransition(async () => {
      const res = await setSiteDataMode(confirmingMode);
      setConfirmingMode(null);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className={`btn btn-small ${currentMode === "live" ? "btn-primary" : "btn-ghost"}`} disabled={isPending} onClick={() => currentMode !== "live" && setConfirmingMode("live")}>
          Live
        </button>
        <button type="button" className={`btn btn-small ${currentMode === "test" ? "btn-primary" : "btn-ghost"}`} disabled={isPending} onClick={() => currentMode !== "test" && setConfirmingMode("test")}>
          Test
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--admin-danger, #B7472A)", marginTop: 6 }}>{error}</p>}

      {confirmingMode && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,20,32,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => !isPending && setConfirmingMode(null)}>
          <div className="map-card" style={{ padding: 24, maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Switch the whole site to {confirmingMode === "test" ? "Test" : "Live"} mode?</h3>
            <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginBottom: 16 }}>
              {confirmingMode === "test"
                ? "Every new account, book submission, and order created from now on will be automatically flagged as test data — until you switch back to Live. Existing data isn't affected by this switch itself."
                : "New accounts, books, and orders created from now on will be treated as real/live data again."}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setConfirmingMode(null)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleConfirm}>{isPending ? "Switching…" : "Confirm"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
