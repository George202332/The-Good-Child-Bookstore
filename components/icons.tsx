// Icons ported verbatim from the original frontend's ICONS object and the
// "owl" motif in motifSvg() (the-good-child-bookstore_54_1.html:3213-3226,
// 1926). Kept as React components rather than raw strings so they behave
// like normal JSX (props, sizing) instead of dangerouslySetInnerHTML.

export function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}

export function BagIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3F3350" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3F3350" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3F3350" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.5C12 20.5 4 15.6 4 9.9C4 6.9 6.35 4.5 9.3 4.5C10.9 4.5 12 5.6 12 5.6C12 5.6 13.1 4.5 14.7 4.5C17.65 4.5 20 6.9 20 9.9C20 15.6 12 20.5 12 20.5Z" />
    </svg>
  );
}

/** The owl motif used inside the logo mark, colored ink (#3F3350) as in
 * the header, or pink-tinted as in the footer variant via `color`. */
export function OwlMotif({ color = "#3F3350" }: { color?: string }) {
  return (
    <>
      <ellipse cx="50" cy="55" rx="32" ry="36" fill={color} />
      <circle cx="38" cy="45" r="10" fill="#fff" opacity={0.85} />
      <circle cx="62" cy="45" r="10" fill="#fff" opacity={0.85} />
      <circle cx="38" cy="45" r="4" fill={color} />
      <circle cx="62" cy="45" r="4" fill={color} />
      <path d="M50 55 L44 65 L56 65Z" fill="#F4B942" />
    </>
  );
}
