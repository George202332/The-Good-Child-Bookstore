"use client";

import { useState } from "react";

export function PlanButton({ featured }: { featured: boolean }) {
  const [clicked, setClicked] = useState(false);
  return (
    <button
      type="button"
      className={`btn ${featured ? "btn-primary" : "btn-ghost"}`}
      style={{ justifyContent: "center", marginTop: "auto" }}
      onClick={() => setClicked(true)}
    >
      {clicked ? "Thanks — subscriptions launch soon!" : "Start this plan"}
    </button>
  );
}
