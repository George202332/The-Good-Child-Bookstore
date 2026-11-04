"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStagingLuluSwitchAction } from "@/actions/admin-lulu";

/** Shown on the staging site only. Real Lulu orders from staging are allowed only while this is ON (default OFF). */
export function StagingLuluSwitch({ on, changedAt, changedBy }: { on: boolean; changedAt?: string; changedBy?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div role="note" style={{ background: on ? "#fde2e2" : "#fff3cd", color: "#3a2a00", padding: "12px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13.5 }}>
      <strong>Staging: allow real Lulu orders from staging is {on ? "ON" : "OFF"}.</strong>{" "}
      {on
        ? "A staging order that has a confirmed payment WILL create a real print order on your live Lulu account, labelled STAGING TEST, CANCEL. Cancel each one in the Lulu dashboard. They are left out of Accounting."
        : "Staging orders are held and nothing is sent to Lulu."}
      {changedAt && <span style={{ opacity: 0.75 }}> (last changed {new Date(changedAt).toLocaleString()}{changedBy ? ` by ${changedBy}` : ""})</span>}
      <div style={{ marginTop: 8 }}>
        <button
          type="button" className="btn btn-primary btn-small" disabled={pending}
          onClick={() => start(async () => {
            if (!on && !window.confirm("Turn ON real Lulu orders from staging? Real print orders will be created on your live Lulu account and you must cancel them yourself.")) return;
            const r = await setStagingLuluSwitchAction(!on);
            setErr(r.ok ? "" : r.error ?? "Failed.");
            router.refresh();
          })}
        >
          {pending ? "Saving..." : on ? "Turn OFF" : "Turn ON"}
        </button>
        {err && <span role="alert" style={{ color: "#a1262a", marginLeft: 10 }}>{err}</span>}
      </div>
    </div>
  );
}
