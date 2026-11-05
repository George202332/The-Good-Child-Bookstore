import { CATEGORIES, GENRES, SUBCATEGORIES, categorySlug, type BookCategory } from "@/lib/taxonomy";
import { AGE_TIERS, AGE_TIER_LABELS } from "@/lib/age-groups";
import { slugify } from "@/lib/seo/text";

/**
 * Crawlable topic pages for books: /browse/{kind}/{slug}. Every category, subcategory, genre and age group gets a real address
 * with a title, description and a list of ordinary links, instead of existing only as a filter on the bookshelf.
 */
export type TopicKind = "category" | "subcategory" | "genre" | "age";

export interface BookTopicInfo {
  series?: string | null;
  subcategory?: string | null;
  genre?: string | null;
  ages?: string[] | null;
  age?: string | null;
}

export interface Topic {
  kind: TopicKind;
  slug: string;
  name: string;
  /** Plain-words heading, e.g. "Adventure Series children's books". */
  heading: string;
  parent?: { kind: TopicKind; slug: string; name: string };
}

export function allTopics(): Topic[] {
  const out: Topic[] = [];
  for (const c of CATEGORIES) out.push({ kind: "category", slug: categorySlug(c), name: c, heading: `${c} children's books` });
  for (const c of CATEGORIES) {
    for (const s of SUBCATEGORIES[c as BookCategory]) {
      out.push({ kind: "subcategory", slug: slugify(s), name: s, heading: `${s} children's books`, parent: { kind: "category", slug: categorySlug(c), name: c } });
    }
  }
  for (const g of GENRES) out.push({ kind: "genre", slug: slugify(g), name: g, heading: `${g} for children` });
  for (const t of AGE_TIERS) out.push({ kind: "age", slug: t, name: AGE_TIER_LABELS[t], heading: `Children's books for ages ${AGE_TIER_LABELS[t]}` });
  return out;
}

export function findTopic(kind: string, slug: string): Topic | undefined {
  return allTopics().find((t) => t.kind === kind && t.slug === slug);
}

export function bookMatchesTopic(book: BookTopicInfo, t: Topic): boolean {
  switch (t.kind) {
    case "category": return (book.series ?? "") === t.name;
    case "subcategory": return (book.subcategory ?? "") === t.name;
    case "genre": return (book.genre ?? "") === t.name;
    case "age": return (book.ages && book.ages.length ? book.ages : book.age ? [book.age] : []).some((a) => a === t.slug || a.startsWith(`${t.slug}`) || a.includes(t.slug));
  }
}

export function topicPath(t: { kind: string; slug: string }): string {
  return `/browse/${t.kind}/${t.slug}`;
}

export function topicDescription(t: Topic, count: number): string {
  const n = count === 1 ? "1 book" : `${count} books`;
  switch (t.kind) {
    case "category": return `Browse ${n} in the ${t.name} collection at The Good Child Bookstore: children's books chosen by independent authors, in eBook, audiobook and print.`;
    case "subcategory": return `Browse ${n} about ${t.name.toLowerCase()} for children, from independent authors, in eBook, audiobook and print.`;
    case "genre": return `Browse ${n} of ${t.name.toLowerCase()} for children at The Good Child Bookstore, in eBook, audiobook and print.`;
    case "age": return `Browse ${n} for children aged ${t.name}, from independent authors, in eBook, audiobook and print.`;
  }
}

/** A topic page with fewer than this many books is not indexed (too thin) and is left out of the sitemap. */
export const MIN_BOOKS_FOR_INDEX = 1;
