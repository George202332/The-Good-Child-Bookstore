"use client";

import { useState } from "react";
import { uploadImage } from "@/actions/images";

/**
 * A real "upload an image" control, styled to match the original's own
 * .upload-card design exactly (the-good-child-bookstore_54_1.html:1509-
 * 1523, 9040-9046 for the book cover card specifically) — dashed border,
 * centered icon, title, and a size hint, turning solid green with a
 * checkmark once a file is attached. Accepts any image format (JPG,
 * PNG, GIF, WEBP, BMP, TIFF, AVIF, HEIC, SVG) and every upload is
 * converted to WebP server-side (see actions/images.ts) before it's
 * stored. Supports both click-to-browse and drag-and-drop — dropping a
 * file anywhere on the card uploads it the same way as picking one
 * through the file dialog, and clicking an already-uploaded (green)
 * card reopens the file picker to replace it.
 */
export function ImageUploadField({
  label,
  recommendedSize,
  value,
  onChange,
  trim,
  fillWidth,
}: {
  label: string;
  recommendedSize?: string;
  value?: string;
  onChange: (url: string) => void;
  /** Auto-crops away transparent/uniform-color padding around the
   * actual visible content before storing — use for logos/favicons,
   * where the source file often has much more canvas than artwork. Not
   * used for book covers or promotional images, where intentional
   * white space can be part of the design. */
  trim?: boolean;
  /** When true, this card becomes an equal flex-distributed member of
   * its parent's .upload-cards-row (grows/shrinks with its siblings,
   * min-width 160px) instead of the standalone 280px cap used when this
   * field appears on its own (e.g. Site Settings logo/favicon). */
  fillWidth?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | undefined>(value);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputId = `upload-${label.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadImage(formData, { trim });
    setUploading(false);

    if (!res.ok || !res.url) {
      setError(res.error ?? "Upload failed.");
      return;
    }
    setPreview(res.url);
    setFileName(file.name);
    onChange(res.url);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  const hasFile = !!preview;

  return (
    <div style={fillWidth ? { flex: 1, minWidth: 160, marginBottom: 16 } : { maxWidth: 280, marginBottom: 16 }}>
      <div className={`upload-card ${hasFile ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`}>
        <input
          type="file"
          id={inputId}
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label
          htmlFor={inputId}
          className="upload-card-inner"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {hasFile && preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- small upload-card preview thumbnail
            <img src={preview} alt={label} style={{ width: 30, height: 30, objectFit: "cover", borderRadius: 6 }} />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" />
            </svg>
          )}
          <div className="upload-card-title">{label}</div>
          <div className="upload-card-sub upload-card-default-label">
            {uploading ? "Uploading…" : isDragOver ? "Drop to upload" : recommendedSize ?? "Any image format — drag & drop or click"}
          </div>
          <div className="upload-card-success-badge">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
            <span>{fileName ?? "Uploaded"}</span>
          </div>
        </label>
      </div>
      {error && <div className="field-hint" style={{ color: "var(--coral-deep, var(--admin-danger))" }}>{error}</div>}
    </div>
  );
}
