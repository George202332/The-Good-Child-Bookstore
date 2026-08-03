"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRedirect, deleteRedirect, type RedirectRow } from "@/actions/seo-marketing";

export function RedirectsManager({ redirects }: { redirects: RedirectRow[] }) {
  const router = useRouter();
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [statusCode, setStatusCode] = useState(301);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await createRedirect({ fromPath, toPath, statusCode });
    setSubmitting(false);
    if (!res.ok) setError(res.error ?? "Failed.");
    else {
      setFromPath("");
      setToPath("");
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    await deleteRedirect(id);
    router.refresh();
  }

  return (
    <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
      <p className="field-hint" style={{ margin: "0 0 12px" }}>
        Redirects apply on every page load, before Next.js&apos;s own routing: use these for a book or blog post
        that moved or was deleted, so its old link doesn&apos;t just show a 404.
      </p>
      <form onSubmit={handleAdd} className="form-grid-2" style={{ marginBottom: 12 }}>
        <div>
          <label className="field-label">Old path</label>
          <input className="field" type="text" placeholder="/book/old-slug" value={fromPath} onChange={(e) => setFromPath(e.target.value)} />
        </div>
        <div>
          <label className="field-label">New path or URL</label>
          <input className="field" type="text" placeholder="/book/new-slug" value={toPath} onChange={(e) => setToPath(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Type</label>
          <select className="field" value={statusCode} onChange={(e) => setStatusCode(Number(e.target.value))}>
            <option value={301}>301, permanent</option>
            <option value={302}>302, temporary</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>{submitting ? "Adding…" : "Add redirect"}</button>
        </div>
      </form>
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginBottom: 12 }}>{error}</div>}

      {redirects.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>No redirects set up yet.</p>
      ) : (
        redirects.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
            <span>{r.fromPath} → {r.toPath} <span style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>({r.statusCode})</span></span>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => handleDelete(r.id)}>Remove</button>
          </div>
        ))
      )}
    </div>
  );
}
