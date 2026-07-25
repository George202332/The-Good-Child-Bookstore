import Link from "next/link";
import { OwlMotif } from "./icons";

/** Accepts an optional admin-uploaded logo image URL (see
 * /admin/site-settings). When one is set, it renders alone, larger,
 * filling the whole brand area — no circular crop, no "The Good Child
 * Bookstore" text alongside it, since the uploaded logo is meant to
 * carry the whole brand identity itself. Falls back to the original
 * small owl-mark icon + text combo only when no logo has been uploaded. */
export function Logo({ subColor = "var(--coral-deep)", logoImageUrl }: { subColor?: string; logoImageUrl?: string }) {
  if (logoImageUrl) {
    return (
      <Link href="/" className="logo logo-uploaded">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo, not a static asset */}
        <img src={logoImageUrl} alt="Logo" className="logo-mark-uploaded" />
      </Link>
    );
  }

  return (
    <Link href="/" className="logo">
      <svg className="logo-mark" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="28" fill="#F7D8E2" />
        <g transform="translate(6,6) scale(0.8)">
          <OwlMotif />
        </g>
      </svg>
      <span>
        The Good Child
        <span className="logo-sub" style={{ color: subColor }}>
          Bookstore
        </span>
      </span>
    </Link>
  );
}
