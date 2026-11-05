import { firstParagraph, linkCounts, parseBlocks, plainText } from "@/lib/blog/content";
import { normalizeKeyword } from "@/lib/blog/keywords";
import { slugify, wordCount } from "@/lib/seo/text";

export type CheckLevel = "good" | "warn" | "bad";
export interface SeoCheck { id: string; level: CheckLevel; label: string; advice: string }
export interface SeoScore { score: number; level: CheckLevel; checks: SeoCheck[] }

export interface SeoScoreInput {
  title: string;
  slug: string;
  content: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  imageAlt?: string | null;
  hasImage?: boolean;
  focus: string;
  siteHost?: string;
}

const has = (hay: string, kw: string) => normalizeKeyword(hay).includes(normalizeKeyword(kw));

/** Sentences of 25+ words are hard to read; the average is what is judged. */
export function averageSentenceWords(text: string): number {
  const sentences = text.split(/[.!?]+\s+|\n+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 3);
  if (sentences.length === 0) return 0;
  return sentences.reduce((n, s) => n + s.split(/\s+/).length, 0) / sentences.length;
}

export function keywordDensityPercent(text: string, kw: string): number {
  const words = wordCount(text);
  const k = normalizeKeyword(kw);
  if (!k || words === 0) return 0;
  const hits = normalizeKeyword(text).split(k).length - 1;
  return (hits * k.split(" ").length * 100) / words;
}

export function blogSeoScore(i: SeoScoreInput): SeoScore {
  const checks: SeoCheck[] = [];
  const add = (id: string, ok: boolean | "warn", label: string, advice: string) =>
    checks.push({ id, level: ok === true ? "good" : ok === "warn" ? "warn" : "bad", label, advice: ok === true ? "" : advice });
  const text = plainText(i.content);
  const words = wordCount(text);
  const blocks = parseBlocks(i.content);
  const heads = blocks.filter((b) => b.type === "h2" || b.type === "h3") as { text: string }[];
  const focus = i.focus.trim();

  if (!focus) {
    add("focus", false, "Focus keyword", "Choose a focus keyword: the main phrase a parent would type to find this post, such as “bedtime stories for toddlers”.");
  } else {
    add("kw-title", has(i.title, focus), "Keyword in the title", `Put “${focus}” in the post title, ideally near the start.`);
    add("kw-slug", normalizeKeyword(focus).split(" ").filter((w) => w.length > 2).every((w) => i.slug.includes(slugify(w))), "Keyword in the address", `Put the words of “${focus}” in the post address (the slug).`);
    add("kw-first", has(firstParagraph(i.content), focus), "Keyword in the first paragraph", `Mention “${focus}” in the first paragraph.`);
    add("kw-heading", heads.some((h) => has(h.text, focus)), "Keyword in a heading", `Use “${focus}” in at least one heading (a line starting with ## ).`);
    add("kw-meta", !!i.metaDescription && has(i.metaDescription, focus), "Keyword in the meta description", `Write a meta description that includes “${focus}”.`);
    const alt = (i.imageAlt ?? "").trim();
    add("kw-alt", i.hasImage === false ? "warn" : !!alt && has(alt, focus), "Keyword in the image description", i.hasImage === false ? "Add a cover image and describe it with the keyword." : `Describe the cover image (alt text) using “${focus}”.`);
    const d = keywordDensityPercent(text, focus);
    add("kw-density", d <= 3 ? (d > 0 ? true : "warn") : false, "Keyword not overused", d > 3 ? `“${focus}” makes up ${d.toFixed(1)}% of the text. Keep it under 3% and use natural variations.` : `“${focus}” does not appear in the text yet.`);
  }
  add("length", words >= 600 ? true : words >= 300 ? "warn" : false, "Length", words >= 300 ? `Aim for 600 words or more (now ${words}).` : `Only ${words} words. Posts under 300 words are treated as thin; aim for 600 or more.`);
  add("headings", heads.length >= 2 ? true : heads.length === 1 ? "warn" : false, "Headings", "Break the post into sections with headings: start a line with ## for a heading or ### for a sub-heading.");
  const avg = averageSentenceWords(text);
  add("readability", avg === 0 || avg <= 20 ? true : avg <= 25 ? "warn" : false, "Readable sentences", `Sentences average ${avg.toFixed(0)} words. Shorter sentences (under 20 words) are easier to read.`);
  const links = linkCounts(i.content, i.siteHost);
  add("internal", links.internal >= 1, "Link to a book, author or category", "Add at least one link to a book, author or category on this site, written as [words](/book-address).");
  add("external", links.external >= 1 ? true : "warn", "External reference", "Where useful, link to a trustworthy source, written as [words](https://…).");
  const mt = (i.metaTitle?.trim() || i.title).length;
  add("meta-title", mt >= 30 && mt <= 60 ? true : "warn", "Meta title length", `The search title is ${mt} characters. Aim for 30 to 60.`);
  const md = (i.metaDescription ?? "").trim().length;
  add("meta-desc", md >= 110 && md <= 158 ? true : md > 0 ? "warn" : false, "Meta description length", md === 0 ? "Write a meta description (110 to 158 characters)." : `The meta description is ${md} characters. Aim for 110 to 158.`);

  const points = checks.reduce((n, c) => n + (c.level === "good" ? 1 : c.level === "warn" ? 0.5 : 0), 0);
  const score = Math.round((points / checks.length) * 100);
  return { score, level: score >= 80 ? "good" : score >= 50 ? "warn" : "bad", checks };
}
