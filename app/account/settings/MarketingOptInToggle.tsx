"use client";

import { useState } from "react";
import { setMarketingOptIn } from "@/actions/settings";

export function MarketingOptInToggle({ initialOptIn }: { initialOptIn: boolean }) {
  const [optIn, setOptIn] = useState(initialOptIn);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const next = !optIn;
    setOptIn(next);
    setSaving(true);
    await setMarketingOptIn(next);
    setSaving(false);
  }

  return (
    <div className="map-card" style={{ padding: 20, marginTop: 16 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input type="checkbox" checked={optIn} disabled={saving} onChange={handleToggle} />
        Send me occasional marketing emails (new releases, promotions)
      </label>
      <p className="field-hint" style={{ margin: "6px 0 0" }}>
        Off by default. You can turn this off any time here, or via the unsubscribe link in any marketing email.
      </p>
    </div>
  );
}
