"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { bannerImageStyle } from "@/lib/banner-style";

/**
 * The one wrapper every banner on the site sits in. It fixes the "banner
 * shows up empty, then the picture pops in" problem:
 *
 *  - The picture used to be a CSS background, which the browser only starts
 *    downloading late, after styles are applied, so the banner first showed
 *    as a flat colour with its text and the photo appeared a moment later.
 *  - Now a real (invisible) <img> for the same picture is placed in the page
 *    itself, so the browser starts downloading it while the page loads
 *    (high priority for the first banner on the page).
 *  - Until that picture has loaded, the banner shows a soft shimmering
 *    placeholder in its own colour instead of an empty banner; when the
 *    picture is ready the picture and the banner text appear together.
 *  - If the picture is slow or fails, the banner is revealed anyway after a
 *    few seconds (by script and, with no script, by a CSS fallback), so
 *    text and buttons are never left hidden.
 *  - A banner with no picture is shown straight away.
 *
 * The banner's size is fixed by its own styles, so nothing on the page
 * moves while the picture loads.
 */
export function BannerFrame({
  className,
  style,
  imageUrl,
  priority = false,
  href,
  children,
}: {
  className: string;
  style?: CSSProperties;
  imageUrl?: string | null;
  /** True for the banner at the top of the page: downloaded first. */
  priority?: boolean;
  /** Makes the whole banner a link. */
  href?: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(!imageUrl);
  const probe = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const el = probe.current;
    if (el && el.complete && el.naturalWidth > 0) {
      // Already in the browser's cache: nothing to wait for.
      setReady(true);
      return;
    }
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, [imageUrl]);

  const classes = `${className} banner-frame ${ready ? "banner-ready" : "banner-loading"}`;
  const merged: CSSProperties = { ...style, ...(ready && imageUrl ? bannerImageStyle(imageUrl) : {}) };
  const probeImg = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- deliberate plain <img>: its only job is to start the download early and report when it is ready
    <img
      ref={probe}
      className="banner-probe"
      src={imageUrl}
      alt=""
      aria-hidden="true"
      width={1}
      height={1}
      loading="eager"
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onLoad={() => setReady(true)}
      onError={() => setReady(true)}
    />
  ) : null;

  if (href) {
    return (
      <Link href={href} className={classes} style={merged}>
        {probeImg}
        {children}
      </Link>
    );
  }
  return (
    <div className={classes} style={merged}>
      {probeImg}
      {children}
    </div>
  );
}
