"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertSeoEntry, deleteSeoEntry, type SeoEntryRow } from "@/actions/seo-marketing";

export function SeoEntryForm({ entries }: { entries: SeoEntryRow[] }) {
  const router = useRouter();
  const [path, setPath] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await upsertSeoEntry({ path, title, description, ogImageUrl });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setPath("");
    setTitle("");
    setDescription("");
    setOgImageUrl("");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="form-section">
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="seo-path">Path</label>
            <input className="field" id="seo-path" type="text" placeholder="/shop" required value={path} onChange={(e) => setPath(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="seo-title">Title override</label>
            <input className="field" id="seo-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="seo-desc">Description override</label>
        <textarea className="field" id="seo-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="field-label" htmlFor="seo-og">OG image URL</label>
        <input className="field" id="seo-og" type="url" value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)} />
        {error && <div className="field-hint" style={{ color: "var(--coral-deep, var(--admin-danger))" }}>{error}</div>}
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? "Saving…" : "Save override"}
        </button>
      </form>

      <div className="map-card" style={{ padding: "6px 16px", marginTop: 20 }}>
        {entries.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13, textAlign: "center" }}>
            No per-page overrides yet — pages use their own default metadata until you add one here.
          </div>
        ) : (
          entries.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: "monospace" }}>{e.path}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{e.title || "No title override"}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={async () => {
                  if (!confirm(`Delete the SEO override for ${e.path}?`)) return;
                  await deleteSeoEntry(e.id);
                  router.refresh();
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
