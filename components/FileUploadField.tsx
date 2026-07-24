"use client";

import { useState } from "react";
import { uploadGenericFile } from "@/actions/files";

/**
 * A file-upload card matching the exact 4-across "Files" section design
 * (Manuscript / Cover image / Sample pages / Promotional images) — same
 * .upload-card visual language as ImageUploadField, but for non-image
 * files (manuscript PDF/EPUB/MOBI, sample-page PDF) that can't go
 * through image conversion.
 */
export function FileUploadField({
  label,
  sizeHint,
  allowedTypes,
  accept,
  multiple = false,
  onUploaded,
}: {
  label: string;
  sizeHint: string;
  allowedTypes: string[];
  accept: string;
  multiple?: boolean;
  onUploaded: (fileIds: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const inputId = `file-upload-${label.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    const ids: string[] = [];
    const names: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadGenericFile(formData, allowedTypes);
      if (!res.ok || !res.fileId) {
        setError(res.error ?? "Upload failed.");
        setUploading(false);
        return;
      }
      ids.push(res.fileId);
      names.push(res.fileName ?? file.name);
    }
    setUploading(false);
    setFileNames(names);
    onUploaded(ids);
  }

  const hasFile = fileNames.length > 0;

  return (
    <div className="upload-cards-row">
      <div className={`upload-card ${hasFile ? "has-file" : ""}`}>
        <input
          type="file"
          id={inputId}
          accept={accept}
          multiple={multiple}
          style={{ display: "none" }}
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label htmlFor={inputId} className="upload-card-inner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <div className="upload-card-title">{label}</div>
          <div className="upload-card-sub upload-card-default-label">{uploading ? "Uploading…" : sizeHint}</div>
          <div className="upload-card-success-badge">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
            <span>{fileNames.length > 1 ? `${fileNames.length} files` : fileNames[0] ?? "Uploaded"}</span>
          </div>
        </label>
      </div>
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
    </div>
  );
}
