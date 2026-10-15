import Link from "next/link";
import type { ReactNode } from "react";
import { bannerClassName } from "@/lib/banner-style";
import { BannerFrame } from "@/components/BannerFrame";

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
  ctas,
}: {
  tone: "lavender" | "mint" | "pink";
  icon: ReactNode;
  title: string;
  body: string;
  /** Leave both out for a banner with no button. */
  ctaHref?: string;
  ctaLabel?: string;
  imageUrl?: string;
  /** Several buttons side by side (e.g. sign up as a reader / as an author). */
  ctas?: { href: string; label: string }[];
}) {
  return (
    <BannerFrame className={bannerClassName(`promo-banner promo-${tone}`, imageUrl)} imageUrl={imageUrl}>
      <div className="promo-banner-text">
        <div className="promo-banner-icon">{icon}</div>
        <div>
          <h3>{title}</h3>
          <p>{body}</p>
        </div>
      </div>
      {ctas && ctas.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ctas.map((c, i) => (
            <Link key={c.href} href={c.href} className={`btn btn-small ${i === 0 ? "btn-primary" : "btn-ghost"}`}>
              {c.label}
            </Link>
          ))}
        </div>
      )}
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="btn btn-primary btn-small">
          {ctaLabel}
        </Link>
      )}
    </BannerFrame>
  );
}
