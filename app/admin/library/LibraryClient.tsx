"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadToAdminLibrary, deleteLibraryItems, type LibraryItem, type LibraryFolder } from "@/actions/library";

const FOLDERS: { key: LibraryFolder; label: string }[] = [
  { key: "ebooks", label: "eBooks" },
  { key: "paperbacks", label: "Paperbacks" },
  { key: "hardcovers", label: "Hardcovers" },
  { key: "audiobooks", label: "Audiobooks" },
  { key: "images", label: "Images" },
  { key: "admin", label: "Admin" },
  { key: "unsorted", label: "Unsorted" },
];

export function LibraryClient({ items }: { items: LibraryItem[] }) {
  const router = useRouter();
  const [active, setActive] = useState<LibraryFolder>("ebooks");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const visible = items.filter((i) => i.folder === active);
  const counts = FOLDERS.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.key]: items.filter((i) => i.folder === f.key).length }), {});

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(visible.map((i) => i.id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    Array.from(fileList).forEach((f) => formData.append("files", f));
    const res = await uploadToAdminLibrary(formData);
    setUploading(false);
    if (!res.ok) setMessage(res.error ?? "Upload failed.");
    else {
      setMessage(`Uploaded ${res.count} file${res.count === 1 ? "" : "s"} to Admin.`);
      setActive("admin");
      router.refresh();
    }
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} item${selected.size === 1 ? "" : "s"}? This can't be undone.`)) return;
    setDeleting(true);
    const toDelete = visible.filter((i) => selected.has(i.id)).map((i) => ({ id: i.id, kind: i.kind }));
    const res = await deleteLibraryItems(toDelete);
    setDeleting(false);
    if (!res.ok) setMessage(res.error ?? "Delete failed.");
    else {
      clearSelection();
      startTransition(() => router.refresh());
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {FOLDERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setActive(f.key); clearSelection(); }}
            style={{
              padding: "6px 16px", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              border: `2px solid ${active === f.key ? "var(--admin-accent, #5B8DEF)" : "var(--admin-border, #2A3244)"}`,
              background: active === f.key ? "var(--admin-accent, #5B8DEF)" : "var(--admin-panel, #171D2B)",
              color: active === f.key ? "#fff" : "var(--admin-text, #E8EBF2)",
            }}
          >
            {f.label} ({counts[f.key] ?? 0})
          </button>
        ))}
      </div>

      {active === "admin" && (
        <div
          className="map-card"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          style={{
            padding: 28, textAlign: "center", marginBottom: 20, cursor: "pointer",
            border: `2px dashed ${dragOver ? "var(--admin-accent, #7C5CFF)" : "var(--admin-border, #2A3244)"}`,
            background: dragOver ? "var(--admin-panel-hover, #1D2536)" : "var(--admin-panel, #171D2B)",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {uploading ? "Uploading…" : "Drag and drop files here, or click to browse"}
          </p>
          <p style={{ fontSize: 12, color: "var(--admin-text-faint, #6B7385)", marginBottom: 12 }}>
            Images are converted to WebP automatically. Any other file type is stored as-is.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button type="button" className="btn btn-primary btn-small" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              Choose files
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={(e) => { e.stopPropagation(); dirInputRef.current?.click(); }}>
              Choose a folder
            </button>
          </div>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
          {/* @ts-expect-error -- webkitdirectory isn't in the standard DOM typings but is broadly supported for folder picking */}
          <input ref={dirInputRef} type="file" multiple webkitdirectory="" hidden onChange={(e) => handleFiles(e.target.files)} />
        </div>
      )}

      {message && <p className="field-hint" style={{ marginBottom: 12 }}>{message}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, color: "var(--admin-text-faint, #6B7385)" }}>
          {selected.size > 0 ? `${selected.size} selected` : `${visible.length} item${visible.length === 1 ? "" : "s"}`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {visible.length > 0 && (
            <button type="button" className="btn btn-ghost btn-small" onClick={selected.size === visible.length ? clearSelection : selectAll}>
              {selected.size === visible.length ? "Deselect all" : "Select all"}
            </button>
          )}
          {selected.size > 0 && (
            <button type="button" className="btn btn-primary btn-small" disabled={deleting} onClick={handleDelete}>
              {deleting ? "Deleting…" : `Delete (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--admin-text-faint, #6B7385)" }}>
          {active === "audiobooks" ? "No audiobook files yet — audiobook file uploads aren't built yet, only pricing/availability." : "Nothing here yet."}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
          {visible.map((item) => (
            <div
              key={item.id}
              className="map-card"
              style={{ padding: 8, cursor: "pointer", border: selected.has(item.id) ? "2px solid var(--admin-accent, #7C5CFF)" : "2px solid transparent" }}
              onClick={() => toggle(item.id)}
            >
              <div style={{ width: "100%", aspectRatio: "1/1", background: "var(--admin-bg, #0F1420)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 6, position: "relative" }}>
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin library thumbnail, arbitrary uploaded content
                  <img src={item.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} loading="lazy" />
                ) : (
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--admin-text-faint, #6B7385)" strokeWidth={1.5}><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v5h5" /></svg>
                )}
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ position: "absolute", top: 4, left: 4 }}
                />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
              <div style={{ fontSize: 10, color: "var(--admin-text-faint, #6B7385)" }}>{item.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 10.5, color: "var(--admin-accent, #7C5CFF)" }}>Open →</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
