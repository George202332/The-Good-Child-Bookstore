import Link from "next/link";
import type { ReactNode } from "react";

/** Converted from the repeated `.promo-banner` markup used four times in
 * homeHTML() (the-good-child-bookstore_54_1.html, e.g. lines 3772-3785). */
export function PromoBanner({
  tone,
  icon,
  title,
  body,
  ctaHref,
  ctaLabel,
  imageUrl,
}: {
  tone: "lavender" | "mint" | "pink";
  icon: ReactNode;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
  imageUrl?: string;
}) {
  return (
    <div
      className={`promo-banner promo-${tone}`}
      style={imageUrl ? { backgroundImage: `linear-gradient(rgba(20,14,26,0.35), rgba(20,14,26,0.35)), url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <div className="promo-banner-text">
        <div className="promo-banner-icon">{icon}</div>
        <div>
          <h3 style={imageUrl ? { color: "#fff" } : undefined}>{title}</h3>
          <p style={imageUrl ? { color: "rgba(255,255,255,0.9)" } : undefined}>{body}</p>
        </div>
      </div>
      <Link href={ctaHref} className="btn btn-primary btn-small">
        {ctaLabel}
      </Link>
    </div>
  );
}
