import { getPublicSiteUrl } from "@/lib/seo/site-url";

/**
 * Modular JSON-LD generators — reused across book pages, blog posts,
 * and category/breadcrumb navigation, rather than each page building
 * its own ad-hoc schema object. Returns plain objects (JSON.stringify'd
 * by the caller into a <script type="application/ld+json">).
 */

export interface BookJsonLdInput {
  title: string;
  authorName: string;
  authorId?: string;
  illustrator?: string;
  isbn?: string;
  genre?: string;
  edition?: string;
  ageRange?: string;
  price: number;
  currency?: string;
  inStock?: boolean;
  ratingValue?: string;
  reviewCount?: number;
  reviews?: { author: string; body: string; rating?: number; datePublished?: string }[];
  imageUrl?: string;
}

/** Book + Product merged schema — Google reads either, and merging both
 * on the same object is Google's own documented pattern for "rich
 * product" results (star rating, age suitability, price shown directly
 * in search results). */
export function bookJsonLd(input: BookJsonLdInput) {
  const siteUrl = getPublicSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": ["Book", "Product"],
    name: input.title,
    author: {
      "@type": "Person",
      name: input.authorName,
      ...(input.authorId ? { url: `${siteUrl}/authors/profile/${input.authorId}` } : {}),
    },
    ...(input.illustrator ? { illustrator: { "@type": "Person", name: input.illustrator } } : {}),
    ...(input.isbn ? { isbn: input.isbn } : {}),
    ...(input.genre ? { genre: input.genre } : {}),
    ...(input.edition ? { bookEdition: input.edition } : {}),
    ...(input.ageRange ? { audience: { "@type": "PeopleAudience", suggestedMinAge: input.ageRange.split("-")[0], suggestedMaxAge: input.ageRange.split("-")[1] } } : {}),
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    inLanguage: "en",
    ...(input.reviewCount && input.reviewCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: input.ratingValue ?? "0", reviewCount: input.reviewCount } }
      : {}),
    ...(input.reviews && input.reviews.length > 0
      ? {
          review: input.reviews.slice(0, 10).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.author },
            reviewBody: r.body,
            ...(r.rating ? { reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 } } : {}),
            ...(r.datePublished ? { datePublished: r.datePublished } : {}),
          })),
        }
      : {}),
    offers: {
      "@type": "Offer",
      price: input.price.toFixed(2),
      priceCurrency: input.currency ?? "USD",
      availability: input.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };
}

export interface BlogJsonLdInput {
  title: string;
  slug: string;
  excerpt: string;
  authorName: string;
  authorId?: string;
  authorBio?: string;
  datePublished: string;
  dateModified: string;
  imageUrl?: string;
}

/** BlogPosting/Article schema with a real Person author (linked to their
 * public profile, satisfying "canonical author profile URLs" for
 * E-E-A-T) and an Organization publisher. */
export function blogPostingJsonLd(input: BlogJsonLdInput) {
  const siteUrl = getPublicSiteUrl();
  const url = `${siteUrl}/blog/${input.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": ["BlogPosting", "Article"],
    headline: input.title,
    description: input.excerpt,
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    author: {
      "@type": "Person",
      name: input.authorName,
      ...(input.authorBio ? { description: input.authorBio } : {}),
      ...(input.authorId ? { url: `${siteUrl}/authors/profile/${input.authorId}`, sameAs: [`${siteUrl}/authors/profile/${input.authorId}`] } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: "The Good Child Bookstore",
      logo: { "@type": "ImageObject", url: `${siteUrl}/favicon.ico` },
    },
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

/** Dynamic BreadcrumbList generator for any nested route
 * (/category/age-group/book-title-style paths). */
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
