"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBook, type UpdateBookInput } from "@/actions/submissions";
import { ImageUploadField } from "@/components/ImageUploadField";

export function EditBookForm({ initial }: { initial: UpdateBookInput }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? "");
  const [description, setDescription] = useState(initial.description);
  const [price, setPrice] = useState(initial.price.toString());
  const [ageGroup, setAgeGroup] = useState(initial.ageGroup);
  const [category, setCategory] = useState(initial.category);
  const [genre, setGenre] = useState(initial.genre);
  const [language, setLanguage] = useState(initial.language);
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl ?? "");
  const [samplePages, setSamplePages] = useState<string[]>(initial.samplePageUrls ?? []);
  const [ebook, setEbook] = useState(initial.formats.ebook);
  const [print, setPrint] = useState(initial.formats.print);
  const [audiobook, setAudiobook] = useState(initial.formats.audiobook);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function setSamplePageAt(index: number, url: string) {
    setSamplePages((prev) => {
      const next = [...prev];
      next[index] = url;
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const res = await updateBook({
      bookId: initial.bookId,
      title,
      subtitle,
      description,
      price: Number(price),
      ageGroup,
      category,
      genre,
      language,
      coverImageUrl,
      samplePageUrls: samplePages,
      formats: { ebook, print, audiobook },
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="form-section" style={{ maxWidth: 640 }}>
      <label className="field-label" htmlFor="edit-title">Title</label>
      <input className="field" id="edit-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />

      <label className="field-label" htmlFor="edit-subtitle" style={{ marginTop: 14 }}>Subtitle</label>
      <input className="field" id="edit-subtitle" type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />

      <label className="field-label" htmlFor="edit-description" style={{ marginTop: 14 }}>Description</label>
      <textarea className="field" id="edit-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />

      <div className="form-grid-2" style={{ marginTop: 14 }}>
        <div>
          <label className="field-label" htmlFor="edit-price">Price ($)</label>
          <input className="field" id="edit-price" type="number" min={0.01} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-age">Age group</label>
          <input className="field" id="edit-age" type="text" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-category">Category</label>
          <input className="field" id="edit-category" type="text" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-genre">Genre</label>
          <input className="field" id="edit-genre" type="text" value={genre} onChange={(e) => setGenre(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-language">Language</label>
          <input className="field" id="edit-language" type="text" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <ImageUploadField
          label="Cover image"
          recommendedSize="Recommended 1600×2400px (2:3 ratio)"
          value={coverImageUrl}
          onChange={(url) => setCoverImageUrl(url)}
        />
      </div>

      <label className="field-label" style={{ marginTop: 14 }}>Read Sample pages</label>
      <p className="field-hint" style={{ margin: "-8px 0 10px" }}>
        Upload up to 6 page images — this is exactly what anyone sees when they click &quot;Read sample&quot; on
        this book&apos;s page. Leave any slot empty to skip it.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ImageUploadField
            key={i}
            label={`Page ${i + 1}`}
            recommendedSize="Recommended 1000×1400px"
            value={samplePages[i]}
            onChange={(url) => setSamplePageAt(i, url)}
          />
        ))}
      </div>

      <label className="field-label" style={{ marginTop: 14 }}>Formats</label>
      <div style={{ display: "flex", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
          <input type="checkbox" checked={ebook} onChange={(e) => setEbook(e.target.checked)} /> eBook
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
          <input type="checkbox" checked={print} onChange={(e) => setPrint(e.target.checked)} /> Print
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
          <input type="checkbox" checked={audiobook} onChange={(e) => setAudiobook(e.target.checked)} /> Audiobook
        </label>
      </div>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — resubmitted for review.</div>}
      <button type="submit" className="btn btn-primary btn-small" style={{ marginTop: 16 }} disabled={submitting}>
        {submitting ? "Saving…" : "Save and resubmit for review"}
      </button>
    </form>
  );
}
