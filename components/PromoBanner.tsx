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
}: {
  tone: "lavender" | "mint" | "pink";
  icon: ReactNode;
  title: string;
  body: string;
  /** Leave both out for a banner with no button. */
  ctaHref?: string;
  ctaLabel?: string;
  imageUrl?: string;
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
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="btn btn-primary btn-small">
          {ctaLabel}
        </Link>
      )}
    </BannerFrame>
  );
}
