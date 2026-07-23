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
}: {
  tone: "lavender" | "mint" | "pink";
  icon: ReactNode;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className={`promo-banner promo-${tone}`}>
      <div className="promo-banner-text">
        <div className="promo-banner-icon">{icon}</div>
        <div>
          <h3>{title}</h3>
          <p>{body}</p>
        </div>
      </div>
      <Link href={ctaHref} className="btn btn-primary btn-small">
        {ctaLabel}
      </Link>
    </div>
  );
}
