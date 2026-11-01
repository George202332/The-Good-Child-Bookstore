"use client";

import { useEffect, useRef, useState } from "react";
import { safeHref } from "@/lib/description-html";

function Btn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} aria-label={label} title={label}>{children}</button>;
}

/**
 * Rich-text editor for the Book Description (same look as the other editor panes). Toolbar: bold, italic,
 * underline, headings, bullet and numbered lists, alignment, links, undo and redo, with a live word and
 * character count. Built on a contentEditable div. Pasted text arrives as plain text, and the HTML that is
 * saved is cleaned again on the server (lib/description-html.ts), so only normal formatting is ever stored.
 * The editor and the product page share the .rich-description styles, so what is written here is what is shown.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  maxWords,
  id,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  maxWords?: number;
  id?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [block, setBlock] = useState("p");
  const [linkProblem, setLinkProblem] = useState("");

  function updateCounts() {
    const text = (editorRef.current?.innerText ?? "").replace(/ /g, " ").trim();
    setCounts({ words: text ? text.split(/\s+/).filter(Boolean).length : 0, chars: text.length });
  }

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
    const t = setTimeout(updateCounts, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleInput() {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
    updateCounts();
  }

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  }

  function setBlockFormat(tag: string) {
    setBlock(tag);
    exec("formatBlock", tag);
  }

  function addLink() {
    setLinkProblem("");
    const typed = window.prompt("Web address for the link (for example https://example.com)");
    if (!typed) return;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(typed.trim()) ? typed.trim() : `https://${typed.trim()}`;
    const href = safeHref(withScheme);
    if (!href) { setLinkProblem("Only web addresses starting with http:// or https:// (or an email address) can be used as links."); return; }
    exec("createLink", href);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    handleInput();
  }

  const icon = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d={d} /></svg>;
  const over = maxWords !== undefined && counts.words > maxWords;

  return (
    <div className="editor-pane">
      <div className="editor-toolbar" role="toolbar" aria-label="Description formatting">
        <div className="editor-toolbar-group">
          <select aria-label="Text style" className="editor-block-select" value={block} onChange={(e) => setBlockFormat(e.target.value)}>
            <option value="p">Paragraph</option>
            <option value="h2">Heading</option>
            <option value="h3">Subheading</option>
          </select>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <Btn label="Bold" onClick={() => exec("bold")}><strong>B</strong></Btn>
          <Btn label="Italic" onClick={() => exec("italic")}><em>I</em></Btn>
          <Btn label="Underline" onClick={() => exec("underline")}><u>U</u></Btn>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <Btn label="Bullet list" onClick={() => exec("insertUnorderedList")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="4" cy="6" r="1.2" /><circle cx="4" cy="12" r="1.2" /><circle cx="4" cy="18" r="1.2" /><path d="M9 6h11M9 12h11M9 18h11" /></svg>
          </Btn>
          <Btn label="Numbered list" onClick={() => exec("insertOrderedList")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h1M4 10v2h1.5M4 16h1.5a1 1 0 0 1 0 2H4" /></svg>
          </Btn>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <Btn label="Align left" onClick={() => exec("justifyLeft")}>{icon("M3 6h18M3 12h12M3 18h16")}</Btn>
          <Btn label="Align centre" onClick={() => exec("justifyCenter")}>{icon("M3 6h18M6 12h12M4 18h16")}</Btn>
          <Btn label="Align right" onClick={() => exec("justifyRight")}>{icon("M3 6h18M9 12h12M5 18h16")}</Btn>
          <Btn label="Justify" onClick={() => exec("justifyFull")}>{icon("M3 6h18M3 12h18M3 18h18")}</Btn>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <Btn label="Add link" onClick={addLink}>{icon("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1")}</Btn>
          <Btn label="Remove link" onClick={() => exec("unlink")}>{icon("M10 14a4 4 0 0 0 5.7 0l3-3M14 10a4 4 0 0 0-5.7 0l-3 3M4 4l16 16")}</Btn>
        </div>
        <div className="editor-toolbar-divider" />
        <div className="editor-toolbar-group">
          <Btn label="Undo" onClick={() => exec("undo")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
          </Btn>
          <Btn label="Redo" onClick={() => exec("redo")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
          </Btn>
        </div>
      </div>
      <div
        ref={editorRef}
        id={id}
        className="description-editable rich-description"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Book Description"
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyUp={() => { const b = document.queryCommandValue("formatBlock").toLowerCase(); setBlock(b === "h2" || b === "h3" ? b : "p"); }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      {linkProblem && <div role="alert" className="editor-word-count" style={{ color: "var(--coral-deep)", textAlign: "left" }}>{linkProblem}</div>}
      <div className="editor-word-count" style={over ? { color: "var(--coral-deep)", fontWeight: 700 } : undefined}>
        {maxWords !== undefined ? `${counts.words} / ${maxWords} words${over ? " (over the limit)" : ""}` : `${counts.words} words`} · {counts.chars} characters
      </div>
    </div>
  );
}
