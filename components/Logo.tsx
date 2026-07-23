import Link from "next/link";
import { OwlMotif } from "./icons";

export function Logo({ subColor = "var(--coral-deep)" }: { subColor?: string }) {
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
