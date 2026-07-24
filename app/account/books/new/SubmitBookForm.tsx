"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitBook } from "@/actions/submissions";

const AGE_RANGES = ["0-2", "3-5", "6-8", "9-12", "12-15"];

export function SubmitBookForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(12.99);
  const [ageGroup, setAgeGroup] = useState(AGE_RANGES[1]);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [ebook, setEbook] = useState(true);
  const [print, setPrint] = useState(false);
  const [audiobook, setAudiobook] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(submitForReview: boolean) {
    setSubmitting(true);
    setError(null);
    const res = await submitBook({
      title,
      description,
      price,
      ageGroup,
      language: "en",
      formats: { ebook, print, audiobook },
      coverImageUrl,
      submitForReview,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.push("/account/books");
  }

  return (
    <form
      className="form-section"
      style={{ background: "var(--cream)" }}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(true);
      }}
    >
      <label className="field-label" htmlFor="sub-title">Title</label>
      <input className="field" id="sub-title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} />

      <label className="field-label" htmlFor="sub-desc">Description</label>
      <textarea className="field" id="sub-desc" rows={5} required value={description} onChange={(e) => setDescription(e.target.value)} />

      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-price">Price (USD)</label>
          <input className="field" id="sub-price" type="number" min={0.99} step={0.01} required value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-age">Age range</label>
          <select className="field" id="sub-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            {AGE_RANGES.map((a) => <option key={a} value={a}>{a} years</option>)}
          </select>
        </div>
      </div>

      <label className="field-label" htmlFor="sub-cover">
        Cover image URL <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(optional)</span>
      </label>
      <input className="field" id="sub-cover" type="url" placeholder="https://..." value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} />

      <label className="field-label">Available formats</label>
      <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={ebook} onChange={(e) => setEbook(e.target.checked)} /> eBook
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={print} onChange={(e) => setPrint(e.target.checked)} /> Print (paperback/hardcover)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={audiobook} onChange={(e) => setAudiobook(e.target.checked)} /> Audiobook
        </label>
      </div>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={() => handleSubmit(false)}>
          Save as draft
        </button>
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
