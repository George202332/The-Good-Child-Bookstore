"use client";

import { useEffect, useRef, useState } from "react";
import { uploadImage } from "@/actions/images";

/**
 * The single editing pane for a page's body content — a real
 * contentEditable rich text editor, not a plain textarea of raw HTML.
 * This is what fixes copy/paste retaining formatting: a contentEditable
 * region receives the clipboard's actual rich HTML from the browser's
 * native paste handling (bold, headings, links, spacing all intact),
 * where a plain <textarea> can only ever receive flattened plain text —
 * which is why pasted content looked broken/unformatted before.
 *
 * Adds headings, link insertion, and real inline image upload (via the
 * same upload pipeline as every other image on the site) on top of the
 * existing RichTextEditor's Bold/Italic/Underline/lists/undo — that
 * component is used elsewhere (the ebook submission form's description
 * field) and doesn't support images or headings, so this is a separate
 * component rather than a change to it.
 */
export function PageBodyEditor({
  value,
  onChange,
  minHeight = 320,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkPromptOpen, setLinkPromptOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const savedSelectionRef = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleInput() {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  }

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadImage(formData);
    setUploading(false);
    if (!res.ok || !res.url) return;

    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("insertHTML", false, `<img src="${res.url}" alt="" style="max-width:100%;border-radius:12px;margin:14px 0;" />`);
    handleInput();
  }

  function confirmInsertLink() {
    if (linkUrl.trim()) {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand("createLink", false, linkUrl.trim());
      handleInput();
    }
    setLinkPromptOpen(false);
    setLinkUrl("");
  }

  return (
    <div className="editor-pane" style={{ maxWidth: 1280 }}>
      <div className="editor-toolbar">
        <div className="editor-toolbar-group">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} aria-label="Bold"><strong>B</strong></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} aria-label="Italic"><em>I</em></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} aria-label="Underline"><u>U</u></button>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "<h2>")} aria-label="Heading" style={{ fontWeight: 700, fontSize: 12 }}>H2</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "<h3>")} aria-label="Subheading" style={{ fontWeight: 700, fontSize: 12 }}>H3</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "<p>")} aria-label="Paragraph" style={{ fontSize: 14 }}>¶</button>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} aria-label="Bullet list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="4" cy="6" r="1.2" /><circle cx="4" cy="12" r="1.2" /><circle cx="4" cy="18" r="1.2" />
              <path d="M9 6h11M9 12h11M9 18h11" />
            </svg>
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")} aria-label="Numbered list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h1M4 10v2h1.5M4 16h1.5a1 1 0 0 1 0 2H4" />
            </svg>
          </button>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <button type="button" onMouseDown={saveSelection} onClick={() => setLinkPromptOpen(true)} aria-label="Insert link" style={{ fontSize: 12 }}>Link</button>
          <label style={{ cursor: uploading ? "default" : "pointer", display: "flex", alignItems: "center", padding: "0 8px", fontSize: 12 }}>
            {uploading ? "Uploading…" : "Image"}
            <input type="file" accept="image/*" style={{ display: "none" }} onMouseDown={saveSelection} onChange={handleImageUpload} disabled={uploading} />
          </label>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("undo")} aria-label="Undo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("redo")} aria-label="Redo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
          </button>
        </div>
      </div>

      {linkPromptOpen && (
        <div style={{ display: "flex", gap: 6, padding: 8, borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
          <input
            className="field field-compact"
            type="url"
            placeholder="https://example.com"
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmInsertLink()}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-primary btn-small" onClick={confirmInsertLink}>Add</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => { setLinkPromptOpen(false); setLinkUrl(""); }}>Cancel</button>
        </div>
      )}

      <div
        ref={editorRef}
        className="description-editable page-body-content"
        contentEditable
        onInput={handleInput}
        data-placeholder="Write or paste content here — formatting from the original (bold, headings, links, spacing) is kept as-is."
        suppressContentEditableWarning
        style={{ minHeight }}
      />
    </div>
  );
}
