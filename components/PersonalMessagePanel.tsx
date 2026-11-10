"use client";

import { useId } from "react";
import { PERSONAL_MESSAGE_MAX, PERSONAL_MESSAGE_STYLES, DEFAULT_STYLE_ID } from "@/lib/personal-message";

/**
 * "Personalise Your Copy": the optional message box, the few simple styles, and a live preview of the dedication page. Used on the
 * product page (under the format card) and in the cart/checkout to change a message. It only edits the text and style it is given.
 */
export function PersonalMessagePanel({ value, onChange, defaultLine, compact = false }: {
  value: { text: string; style: string };
  onChange: (v: { text: string; style: string }) => void;
  defaultLine?: string;
  compact?: boolean;
}) {
  const id = useId();
  const style = PERSONAL_MESSAGE_STYLES.find((s) => s.id === value.style) ?? PERSONAL_MESSAGE_STYLES[0];
  const family = style.css.split(";")[0];
  const italic = style.css.includes("italic");
  const shown = value.text.trim() || defaultLine || "";
  return (
    <div className={`pm-panel${compact ? " pm-compact" : ""}`}>
      <div className="pm-title">Personalise Your Copy</div>
      <label className="pm-label" htmlFor={`${id}-text`}>Add A Personal Message <span>(Optional)</span></label>
      <textarea
        id={`${id}-text`}
        className="input pm-text"
        rows={3}
        maxLength={PERSONAL_MESSAGE_MAX}
        value={value.text}
        onChange={(e) => onChange({ text: e.target.value, style: value.style || DEFAULT_STYLE_ID })}
        placeholder="For Amara, on your 7th birthday. Love, Grandpa"
      />
      <div className="pm-count" aria-live="polite">{value.text.length}/{PERSONAL_MESSAGE_MAX}</div>
      <div className="pm-styles" role="radiogroup" aria-label="Message style">
        {PERSONAL_MESSAGE_STYLES.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={value.style === s.id} className={`pm-style${value.style === s.id ? " is-on" : ""}`} onClick={() => onChange({ text: value.text, style: s.id })}>{s.label}</button>
        ))}
      </div>
      <div className="pm-preview" aria-label="Preview of the dedication page">
        <div className="pm-page" style={{ fontFamily: family, fontStyle: italic ? "italic" : "normal" }}>
          {shown ? shown : <span className="pm-empty">Your message will appear here, centred on its own page near the front of the book.</span>}
        </div>
        <div className="pm-note">Preview of the dedication page. The finished page is printed in the same style.</div>
      </div>
    </div>
  );
}
