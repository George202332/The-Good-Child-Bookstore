"use client";

export function CopyCaptionButton({ text }: { text: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-small" onClick={() => navigator.clipboard.writeText(text)}>
      Copy caption
    </button>
  );
}
