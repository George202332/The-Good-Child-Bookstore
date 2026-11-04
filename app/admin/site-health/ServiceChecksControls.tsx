"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runServiceChecksNow, saveAlertEmail } from "@/actions/service-health";

export function RunChecksButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        className="btn btn-primary btn-small"
        disabled={pending}
        onClick={() => start(async () => { const r = await runServiceChecksNow(); setMsg(r.ok ? "" : r.error ?? "Failed."); router.refresh(); })}
      >
        {pending ? "Checking..." : "Check now"}
      </button>
      {msg && <span role="alert" style={{ color: "#d64545", fontSize: 12.5 }}>{msg}</span>}
    </span>
  );
}

export function AlertEmailForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveAlertEmail(value);
          setMsg({ ok: r.ok, text: r.ok ? (value.trim() ? "Saved." : "Alerts are off (no address).") : r.error ?? "Could not save." });
          router.refresh();
        });
      }}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
    >
      <label className="field-label" htmlFor="alert-email" style={{ margin: 0 }}>Send service alerts to</label>
      <input id="alert-email" className="field" type="email" placeholder="alerts@yourdomain.com" value={value} onChange={(e) => setValue(e.target.value)} style={{ minWidth: 260 }} />
      <button type="submit" className="btn btn-primary btn-small" disabled={pending}>{pending ? "Saving..." : "Save"}</button>
      {msg && <span role="status" style={{ fontSize: 12.5, color: msg.ok ? "#2e8b57" : "#d64545" }}>{msg.text}</span>}
    </form>
  );
}
