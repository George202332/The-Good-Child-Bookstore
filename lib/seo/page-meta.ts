import type { Metadata } from "next";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { isIndexableDeployment } from "@/lib/seo/indexing";

export const SITE_NAME = "The Good Child Bookstore";

/**
 * Metadata for an ordinary page: its OWN title, description and canonical address (never the home page's), social preview,
 * and a no-index flag when the page should not be indexed. The canonical address is always the clean path, so a visit
 * through ?aff=, utm tags or filters still points at one address.
 */
export function pageMeta(input: { title: string; description: string; path: string; image?: string | null; noindex?: boolean; type?: "website" | "article" | "book" }): Metadata {
  const site = getPublicSiteUrl();
  const url = `${site}${input.path === "/" ? "" : input.path}` || site;
  const fullTitle = input.title.includes(SITE_NAME) ? input.title : `${input.title} | ${SITE_NAME}`;
  const images = input.image ? [input.image.startsWith("http") ? input.image : `${site}${input.image}`] : undefined;
  return {
    title: { absolute: fullTitle },
    description: input.description,
    alternates: { canonical: url },
    robots: input.noindex || !isIndexableDeployment() ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title: fullTitle, description: input.description, url, siteName: SITE_NAME, type: input.type === "book" ? "book" : input.type === "article" ? "article" : "website", ...(images ? { images } : {}) },
    twitter: { card: images ? "summary_large_image" : "summary", title: fullTitle, description: input.description, ...(images ? { images } : {}) },
  };
}
