"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Rich-text editor matching the original's exact .editor-pane/.editor-
 * toolbar/.description-editable/.editor-word-count design (verbatim CSS
 * already in app/site.css) — Bold/Italic/Underline, bullet/numbered
 * list, undo/redo, and a live word counter. Built on a contentEditable
 * div rather than a full rich-text library, since the actual formatting
 * needs here are simple. Emits HTML via onChange.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  maxWords,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  maxWords?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
      updateWordCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateWordCount() {
    const text = editorRef.current?.innerText ?? "";
    const words = text.trim().split(/\s+/).filter(Boolean);
    setWordCount(text.trim() ? words.length : 0);
  }

  function handleInput() {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
    updateWordCount();
  }

  function exec(command: string) {
    document.execCommand(command);
    editorRef.current?.focus();
    handleInput();
  }

  return (
    <div className="editor-pane">
      <div className="editor-toolbar">
        <div className="editor-toolbar-group">
          <button type="button" onClick={() => exec("bold")} aria-label="Bold"><strong>B</strong></button>
          <button type="button" onClick={() => exec("italic")} aria-label="Italic"><em>I</em></button>
          <button type="button" onClick={() => exec("underline")} aria-label="Underline"><u>U</u></button>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <button type="button" onClick={() => exec("insertUnorderedList")} aria-label="Bullet list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="4" cy="6" r="1.2" /><circle cx="4" cy="12" r="1.2" /><circle cx="4" cy="18" r="1.2" />
              <path d="M9 6h11M9 12h11M9 18h11" />
            </svg>
          </button>
          <button type="button" onClick={() => exec("insertOrderedList")} aria-label="Numbered list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h1M4 10v2h1.5M4 16h1.5a1 1 0 0 1 0 2H4" />
            </svg>
          </button>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <button type="button" onClick={() => exec("undo")} aria-label="Undo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
          </button>
          <button type="button" onClick={() => exec("redo")} aria-label="Redo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
          </button>
        </div>
      </div>
      <div
        ref={editorRef}
        className="description-editable"
        contentEditable
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      <div className="editor-word-count">{maxWords ? `${wordCount} / ${maxWords} words` : `${wordCount} words`}</div>
    </div>
  );
}
