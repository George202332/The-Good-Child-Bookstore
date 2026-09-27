"use client";
import type { ReactNode } from "react";

/**
 * Shared modal overlay — replaces the ~8 places that used to hand-roll
 * their own `position: fixed; inset: 0` backdrop + dialog card. Clicking
 * the backdrop calls onClose; clicking inside the card does not (via
 * stopPropagation).
 */
export function Modal({
  onClose,
  children,
  maxWidth = 480,
}: {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,22,30,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="map-card"
        style={{ maxWidth, width: "100%", padding: 24, maxHeight: "85vh", overflowY: "auto" }}
      >
        {children}
      </div>
    </div>
  );
}
