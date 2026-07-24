import Link from "next/link";
import { OwlMotif } from "./icons";

/** Accepts an optional admin-uploaded logo image URL (see
 * /admin/site-settings) — falls back to the original owl-mark SVG when
 * none is set. */
export function Logo({ subColor = "var(--coral-deep)", logoImageUrl }: { subColor?: string; logoImageUrl?: string }) {
  return (
    <Link href="/" className="logo">
      {logoImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded logo, not a static asset
        <img src={logoImageUrl} alt="The Good Child Bookstore" className="logo-mark" style={{ borderRadius: "50%", objectFit: "cover" }} />
      ) : (
        <svg className="logo-mark" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="28" fill="#F7D8E2" />
          <g transform="translate(6,6) scale(0.8)">
            <OwlMotif />
          </g>
        </svg>
      )}
      <span>
        The Good Child
        <span className="logo-sub" style={{ color: subColor }}>
          Bookstore
        </span>
      </span>
    </Link>
  );
}
