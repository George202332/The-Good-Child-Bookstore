"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePublishingFormats } from "@/actions/site-settings";
import type { PublishingFormatsEnabled } from "@/lib/site-settings";

const FORMATS: { key: keyof PublishingFormatsEnabled; label: string }[] = [
  { key: "ebook", label: "eBook" },
  { key: "print", label: "Print" },
  { key: "audiobook", label: "Audio book" },
];

/** Each button is a real on/off switch for that format, not a
 * navigation tab — clicking one toggles whether authors can currently
 * submit a new title in that format at all. Turning one off makes it
 * disappear entirely from the "Submit a new title" page; it never
 * affects books already submitted in that format. */
export function PublishingFormatToggles({ initial }: { initial: PublishingFormatsEnabled }) {
  const router = useRouter();
  const [formats, setFormats] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof PublishingFormatsEnabled) {
    const next = { ...formats, [key]: !formats[key] };
    setError(null);
    startTransition(async () => {
      const res = await updatePublishingFormats(next);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else {
        setFormats(next);
        router.refresh();
      }
    });
  }

  return (
    <div className="map-card" style={{ padding: 20, marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Formats open for submission</h3>
      <p className="field-hint" style={{ margin: "0 0 14px" }}>
        Turn a format off to remove it entirely from the &quot;Submit a new title&quot; page — authors won&apos;t
        see that tab at all. Books already submitted in that format aren&apos;t affected.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        {FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            disabled={isPending}
            className={`btn btn-small ${formats[f.key] ? "btn-primary" : "btn-ghost"}`}
            onClick={() => toggle(f.key)}
          >
            {f.label}: {formats[f.key] ? "On" : "Off"}
          </button>
        ))}
      </div>
      {error && <p style={{ color: "var(--coral-deep)", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
