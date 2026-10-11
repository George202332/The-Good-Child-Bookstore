import type { CSSProperties } from "react";

/**
 * Background for a banner that has an uploaded image: the picture alone,
 * filling the banner — no dark overlay laid over it. (Every banner on the
 * site used to put a 55–58% dark layer between the image and its text;
 * that layer has been removed on purpose so the picture shows at its
 * true brightness. The banner text is black and sits on a soft white
 * panel behind the text only — see `.promo-banner-on-image` in
 * app/site.css — so it stays readable over any picture.)
 */
export function bannerImageStyle(imageUrl: string | undefined | null): CSSProperties {
  if (!imageUrl) return {};
  const safe = imageUrl.replace(/["\\\n\r]/g, (c) => encodeURIComponent(c));
  return { backgroundImage: `url("${safe}")`, backgroundSize: "cover", backgroundPosition: "center" };
}

export function bannerClassName(base: string, imageUrl: string | undefined | null): string {
  return imageUrl ? `${base} promo-banner-on-image` : base;
}
