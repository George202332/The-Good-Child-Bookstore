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
  hideScrollbar = false,
}: {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  /** Hides this card's own outer scrollbar (via the existing
   * .no-scrollbar utility) — opt-in, off by default so every other
   * modal keeps its normal, visible scrollbar. Meant for a caller whose
   * content already has its own inner scrolling area (e.g.
   * ReadSampleViewer's page viewer): without this, that content's
   * scrollbar was hidden as intended, but this outer card still showed
   * its own native scrollbar whenever the card's total height (header +
   * inner viewer) slightly exceeded the 85vh cap, which is what kept
   * showing up as "the scrollbar is still there" after only the inner
   * one had been addressed. */
  hideScrollbar?: boolean;
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
        className={`map-card${hideScrollbar ? " no-scrollbar" : ""}`}
        style={{ maxWidth, width: "100%", padding: 24, maxHeight: "85vh", overflowY: "auto" }}
      >
        {children}
      </div>
    </div>
  );
}
