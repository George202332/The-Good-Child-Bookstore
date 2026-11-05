import { slugify, squash, wordCount } from "@/lib/seo/text";

/**
 * Turns a post's plain text into a clean structure: real headings ("## Heading", "### Subheading"), bullet lists ("- item"),
 * paragraphs, and inline links written as [words](address). Nothing is run as HTML: links are limited to http(s) and site paths.
 * A table of contents, the reading time and the link counts all come from the same parse.
 */
export type Inline = { text: string; href?: string; bold?: boolean };
export type Block =
  | { type: "h2" | "h3"; text: string; id: string }
  | { type: "p"; inline: Inline[] }
  | { type: "quote"; inline: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "img"; src: string; alt: string };

const LINK = /\[([^\]]{1,200})\]\(([^)\s]{1,500})\)/g;

export function safeHref(href: string): string | null {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (/^https?:\/\//i.test(h)) return h;
  return null;
}

/** Splits **bold** out of a run of plain text. */
function withBold(text: string, href?: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(/\*\*([^*]{1,200})\*\*/g)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), ...(href ? { href } : {}) });
    out.push({ text: m[1], bold: true, ...(href ? { href } : {}) });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), ...(href ? { href } : {}) });
  return out;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const href = safeHref(m[2]);
    if (m.index! > last) out.push(...withBold(text.slice(last, m.index)));
    if (href) out.push(...withBold(m[1], href)); else out.push({ text: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(...withBold(text.slice(last)));
  return out.length ? out : [{ text }];
}

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const used = new Map<string, number>();
  const idFor = (t: string) => {
    const base = slugify(t) || "section";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };
  for (const raw of content.split(/\n\s*\n/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const lines = chunk.split("\n");
    // The editor's toolbar writes "# " for the largest heading; the post title is already the page's one main heading, so it is shown as a section heading.
    if (/^#\s+/.test(chunk) && lines.length === 1) { const t = chunk.replace(/^#\s+/, "").trim(); blocks.push({ type: "h2", text: t, id: idFor(t) }); continue; }
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(chunk);
    if (img) { const src = safeHref(img[2]); if (src) blocks.push({ type: "img", src, alt: img[1] }); continue; }
    if (lines.every((l) => /^>\s?/.test(l))) { blocks.push({ type: "quote", inline: parseInline(lines.map((l) => l.replace(/^>\s?/, "")).join(" ")) }); continue; }
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) { blocks.push({ type: "ol", items: lines.map((l) => parseInline(l.replace(/^\s*\d+[.)]\s+/, ""))) }); continue; }
    if (/^###\s+/.test(chunk) && lines.length === 1) { const t = chunk.replace(/^###\s+/, "").trim(); blocks.push({ type: "h3", text: t, id: idFor(t) }); continue; }
    if (/^##\s+/.test(chunk) && lines.length === 1) { const t = chunk.replace(/^##\s+/, "").trim(); blocks.push({ type: "h2", text: t, id: idFor(t) }); continue; }
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) { blocks.push({ type: "ul", items: lines.map((l) => parseInline(l.replace(/^\s*[-*]\s+/, ""))) }); continue; }
    // A heading line followed by text in the same chunk: split it out.
    const head = /^(#{2,3})\s+(.+)$/.exec(lines[0]);
    if (head) {
      const t = head[2].trim();
      blocks.push({ type: head[1] === "##" ? "h2" : "h3", text: t, id: idFor(t) });
      const rest = lines.slice(1).join("\n").trim();
      if (rest) blocks.push({ type: "p", inline: parseInline(rest) });
      continue;
    }
    blocks.push({ type: "p", inline: parseInline(chunk) });
  }
  return blocks;
}

export function tocOf(blocks: Block[]): { id: string; text: string; level: 2 | 3 }[] {
  return blocks.flatMap((b) => (b.type === "h2" || b.type === "h3" ? [{ id: b.id, text: b.text, level: (b.type === "h2" ? 2 : 3) as 2 | 3 }] : []));
}

export function plainText(content: string): string {
  return squash(content.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(LINK, "$1").replace(/\*\*/g, "").replace(/^#{1,3}\s+/gm, "").replace(/^>\s?/gm, "").replace(/^\s*([-*]|\d+[.)])\s+/gm, ""));
}

export function readTimeMinutes(content: string): number {
  return Math.max(1, Math.round(wordCount(plainText(content)) / 200));
}

export function linkCounts(content: string, siteHost?: string): { internal: number; external: number } {
  let internal = 0, external = 0;
  for (const m of content.matchAll(LINK)) {
    const href = safeHref(m[2]);
    if (!href) continue;
    if (href.startsWith("/")) { internal++; continue; }
    try {
      const host = new URL(href).host.replace(/^www\./, "");
      if (siteHost && host === siteHost.replace(/^www\./, "")) internal++; else external++;
    } catch { /* not a valid address: ignored */ }
  }
  return { internal, external };
}

/** First paragraph of text (headings and lists skipped), for the keyword check and the structured-data description. */
export function firstParagraph(content: string): string {
  const b = parseBlocks(content).find((x) => x.type === "p");
  return b && b.type === "p" ? b.inline.map((i) => i.text).join("") : "";
}
