"use client";

import { useState } from "react";
import { uploadGenericFile } from "@/actions/files";

/**
 * A file-upload card matching the exact 4-across "Files" section design
 * (Manuscript / Cover image / Sample pages / Promotional images) — same
 * .upload-card visual language as ImageUploadField, but for non-image
 * files (manuscript PDF/EPUB/MOBI, print-ready/back-cover PDFs) that
 * can't go through image conversion. Supports both click-to-browse and
 * drag-and-drop, and clicking an already-uploaded (green) card reopens
 * the file picker to replace it. File-type validation accepts either a
 * matching MIME type or a matching file extension — some browser/OS
 * combinations report an empty or nonstandard MIME type for a perfectly
 * valid PDF, and requiring an exact MIME match was rejecting those
 * genuinely valid uploads outright (see actions/files.ts).
 */
export function FileUploadField({
  label,
  sizeHint,
  allowedTypes,
  accept,
  multiple = false,
  onUploaded,
  fillWidth,
}: {
  label: string;
  sizeHint: string;
  allowedTypes: string[];
  accept: string;
  multiple?: boolean;
  onUploaded: (fileIds: string[]) => void;
  /** When true, this card becomes an equal flex-distributed member of
   * its parent's .upload-cards-row (grows/shrinks with its siblings,
   * min-width 160px) instead of growing unpredictably on its own. */
  fillWidth?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputId = `file-upload-${label.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

  async function uploadFiles(files: File[]) {
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    uploadFiles(Array.from(e.target.files ?? []));
    // Allow re-selecting the exact same file path again (browsers don't
    // fire onChange a second time for an unchanged value otherwise),
    // which is what makes "click the green card to reupload" reliable
    // even when reuploading the identical file.
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    uploadFiles(multiple ? files : files.slice(0, 1));
  }

  const hasFile = fileNames.length > 0;

  return (
    <div style={fillWidth ? { flex: 1, minWidth: 160 } : undefined}>
      <div className={`upload-card ${hasFile ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`}>
        <input
          type="file"
          id={inputId}
          accept={accept}
          multiple={multiple}
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <div className="upload-card-title">{label}</div>
          <div className="upload-card-sub upload-card-default-label">
            {uploading ? "Uploading…" : isDragOver ? "Drop to upload" : `${sizeHint} — drag & drop or click`}
          </div>
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
