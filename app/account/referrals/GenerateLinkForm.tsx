"use client";

import { useEffect, useState } from "react";
import { BOOKS } from "@/lib/data/catalog";
import { getOrCreateAffiliateLink } from "@/actions/affiliate";
import { listMyCampaignOptions, type CampaignOption } from "@/actions/campaigns";

const PROMOTABLE_BOOKS = BOOKS.filter((b) => b.affiliateEnabled);

export function GenerateLinkForm() {
  const [bookId, setBookId] = useState(PROMOTABLE_BOOKS[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [result, setResult] = useState<{ code: string; bookId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMyCampaignOptions().then(setCampaigns);
  }, []);

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    const res = await getOrCreateAffiliateLink(bookId, campaignId || undefined);
    setSubmitting(false);
    if (!res.ok || !res.code) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setResult({ code: res.code, bookId });
  }

  return (
    <div className="form-section" style={{ background: "var(--cream)" }}>
      <label className="field-label" htmlFor="ref-book">Book to promote</label>
      <select className="field" id="ref-book" value={bookId} onChange={(e) => setBookId(e.target.value)}>
        {PROMOTABLE_BOOKS.map((b) => (
          <option key={b.id} value={b.id}>{b.title} — {b.author}</option>
        ))}
      </select>
      {campaigns.length > 0 && (
        <>
          <label className="field-label" htmlFor="ref-campaign">
            Campaign <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(optional)</span>
          </label>
          <select className="field" id="ref-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </>
      )}
      <button type="button" className="btn btn-primary btn-small" onClick={handleGenerate} disabled={submitting}>
        {submitting ? "Generating…" : "Generate link"}
      </button>
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {result && (
        <div className="field-hint" style={{ marginTop: 10 }}>
          Your link: <code>/book/{result.bookId}?aff={result.code}</code>
        </div>
      )}
    </div>
  );
}
