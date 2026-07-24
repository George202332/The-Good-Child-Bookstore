"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/actions/images";

/**
 * A real "upload an image" control — replaces the paste-a-URL fields
 * that used to be the only option for logo/payment-badge/book-cover
 * images. Every upload is converted to WebP server-side (see
 * actions/images.ts) before it's stored.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | undefined>(value);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadImage(formData);
    setUploading(false);

    if (!res.ok || !res.url) {
      setError(res.error ?? "Upload failed.");
      return;
    }
    setPreview(res.url);
    onChange(res.url);
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label className="field-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- previewing an uploaded image, not a static asset
          <img
            src={preview}
            alt={`${label} preview`}
            style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", padding: 4 }}
          />
        )}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ fontSize: 12.5 }}
          />
          {uploading && <div className="field-hint">Uploading and converting to WebP…</div>}
          {error && <div className="field-hint" style={{ color: "var(--coral-deep, var(--admin-danger))" }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
