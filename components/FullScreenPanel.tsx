"use client";
import type { ReactNode } from "react";

/**
 * A full-screen overlay panel — for content too detailed for the
 * centered Modal (see Modal.tsx) to show comfortably, such as the admin
 * Users per-account activity log (app/admin/users/UserActivityLog.tsx),
 * which combines a profile summary with a potentially long event list.
 * Same click-backdrop-to-close convention as Modal, just covering the
 * whole viewport with its own scroll region instead of a centered card.
 */
export function FullScreenPanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "var(--admin-bg, #14161e)", zIndex: 300, overflowY: "auto" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 60px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
