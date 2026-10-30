"use client";

import { AI_NONE, AI_USED, aiChoiceOf, aiTextFor, type AiChoice } from "@/lib/ai-declaration";

/**
 * Two tick boxes that work as ONE choice: ticking one unticks the other, and ticking the ticked
 * one again clears the choice. The value is the full statement (see lib/ai-declaration.ts).
 * One declaration covers the whole book, so every format's form shows the same value.
 */
export function AiDeclarationField({ id, value, onChange, legacyNote }: { id: string; value: string; onChange: (next: string) => void; legacyNote?: boolean }) {
  const choice = aiChoiceOf(value);
  const pick = (c: AiChoice) => onChange(aiTextFor(choice === c ? "" : c));
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
