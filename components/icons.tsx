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
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3F3350" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8.5h10l-0.8 11.2a1.5 1.5 0 0 1-1.5 1.3H9.3a1.5 1.5 0 0 1-1.5-1.3L7 8.5z" />
      <path d="M9 8.5V6.8a3 3 0 0 1 6 0V8.5" />
      <path d="M8.3 11.5h7.4" strokeWidth="1.2" opacity="0.55" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3F3350" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M5.2 19.5c0.6-4 3.3-6.3 6.8-6.3s6.2 2.3 6.8 6.3" />
    </svg>
  );
}

export function HeartIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3F3350" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20C12 20 3.8 15 3.8 9.1C3.8 6.1 6.1 3.8 9 3.8C10.7 3.8 12 4.9 12 4.9C12 4.9 13.3 3.8 15 3.8C17.9 3.8 20.2 6.1 20.2 9.1C20.2 15 12 20 12 20Z" />
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
