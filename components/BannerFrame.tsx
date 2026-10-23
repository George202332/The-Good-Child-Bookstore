import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { imageAtWidth, isUploadedImage, responsiveImage } from "@/lib/image-url";

/**
 * The one wrapper every banner on the site sits in.
 *
 * Banner pictures used to be a CSS background switched on by a script after
 * the page had loaded, and the banner's text stayed hidden until then - so a
 * banner first appeared empty and the picture popped in afterwards. Now:
 *
 *  - The picture is a real <img> in the page's own HTML (not a script-applied
 *    background), so the browser starts downloading it the moment the HTML
 *    arrives; the first banner on the page asks for top priority.
 *  - It is served at a size that suits the screen (a few hundred KB, not a
 *    2000-pixel original) via the image route's ?w= copies and srcset.
 *  - A tiny blurred copy of the same picture sits underneath as a placeholder,
 *    so even before the full picture is ready the banner shows its colours
 *    rather than a flat empty box.
 *  - Text and buttons are always visible straight away - they never wait.
 *  - The banner's height comes from its own styles, so nothing on the page
 *    moves while the picture arrives.
 */
export function BannerFrame({
  className,
  style,
  imageUrl,
  priority = false,
  eager = false,
  href,
  children,
}: {
  className: string;
  style?: CSSProperties;
  imageUrl?: string | null;
  /** True for the banner at the top of the page: downloaded first. */
  priority?: boolean;
  /** Download straight away even when not the first banner (stacked carousel slides). */
  eager?: boolean;
  /** Makes the whole banner a link. */
  href?: string;
  children: ReactNode;
}) {
  const classes = `${className} banner-frame`;
  const uploaded = isUploadedImage(imageUrl);
  const full = imageUrl ? responsiveImage(imageUrl, [640, 960, 1280, 1600]) : null;

  const pictures = imageUrl && full ? (
    <>
      {uploaded && (
        // eslint-disable-next-line @next/next/no-img-element -- tiny blurred stand-in shown until the full picture is ready
        <img className="banner-blur" src={imageAtWidth(imageUrl, 24)} alt="" aria-hidden="true" width={24} height={12} decoding="async" fetchPriority={priority ? "high" : "auto"} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- own image route with explicit srcset, see lib/image-url.ts */}
      <img
        className="banner-img"
        src={full.src}
        srcSet={full.srcSet}
        sizes="(max-width: 1240px) 100vw, 1200px"
        alt=""
        aria-hidden="true"
        loading={priority || eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
      />
    </>
  ) : null;

  if (href) {
    return (
      <Link href={href} className={classes} style={style}>
        {pictures}
        {children}
      </Link>
    );
  }
  return (
    <div className={classes} style={style}>
      {pictures}
      {children}
    </div>
  );
}
