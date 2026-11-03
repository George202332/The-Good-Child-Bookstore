"use client";

import { useState } from "react";
import { AI_NONE, AI_USED, aiChoiceOf, aiTextFor, type AiChoice } from "@/lib/ai-declaration";

/**
 * Two tick boxes that work as ONE choice: ticking one unticks the other, and ticking the ticked
 * one again clears the choice. The value is the full statement (see lib/ai-declaration.ts).
 *
 * One declaration covers the whole book, so every format's form shows the same value. When `shared` is set (the form sits
 * beside another format's form) and the answer already exists because it was made on another tab or saved earlier, this tab does
 * not ask again: it shows the existing answer read-only with a note that it applies to the whole book, and a Change button. The
 * answer can be changed from either tab and the change applies to the whole book.
 */
export function AiDeclarationField({ id, value, onChange, legacyNote, shared = false }: { id: string; value: string; onChange: (next: string) => void; legacyNote?: boolean; shared?: boolean }) {
  const choice = aiChoiceOf(value);
  // true once this tab itself made or reopened the answer: the tab where you just ticked stays editable.
  const [touched, setTouched] = useState(false);
  const pick = (c: AiChoice) => {
    setTouched(true);
    onChange(aiTextFor(choice === c ? "" : c));
  };

  if (shared && choice !== "" && !touched) {
    return (
      <fieldset id={id} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field-label">AI Use Declaration</legend>
        <p className="field-hint" role="status" style={{ margin: "0 0 8px" }}>
          This answer applies to the whole book, every format. It was already given, so you are not asked again here.
        </p>
        <div style={{ background: "var(--cream)", border: "1px solid var(--line-strong)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
          {choice === "ai" ? AI_USED : AI_NONE}
        </div>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setTouched(true)}>Change Answer</button>
      </fieldset>
    );
  }

  return (
    <fieldset id={id} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="field-label">AI Use Declaration</legend>
      <p className="field-hint" style={{ margin: "0 0 8px" }}>
        Tick exactly one. This is one answer for the whole book, the same for every format, and it shows on the book&apos;s product page.
      </p>
      {legacyNote && (
        <p className="field-hint" role="status" style={{ margin: "0 0 8px", color: "var(--coral-deep)" }}>
          This book has an older written declaration. Please tick the box that matches it; it is kept on record.
        </p>
      )}
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={choice === "ai"} onChange={() => pick("ai")} style={{ marginTop: 3 }} />
        <span>{AI_USED}</span>
      </label>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={choice === "none"} onChange={() => pick("none")} style={{ marginTop: 3 }} />
        <span>{AI_NONE}</span>
      </label>
    </fieldset>
  );
}
