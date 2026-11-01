/**
 * The book description is written in a small rich editor and shown on the product page exactly as written.
 * Only ordinary formatting is allowed: paragraphs, bold, italic, underline, two heading sizes, bullet and
 * numbered lists, left/centre/right/justified alignment and web links. Everything else is removed, and
 * nothing can carry a script or an event handler. It is cleaned when saved AND again when read.
 */

const ALLOWED = new Set(["p", "br", "strong", "em", "u", "h2", "h3", "ul", "ol", "li", "a"]);
const ALIAS: Record<string, string> = { b: "strong", i: "em", div: "p", h1: "h2", h4: "h3", h5: "h3", h6: "h3" };
/** Elements whose whole content is dropped, not just the tags. */
const DROP_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "head", "title"]);
const VOID = new Set(["br"]);
const ALIGN = /text-align\s*:\s*(left|center|right|justify)/i;

const escapeText = (t: string) => t.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (t: string) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A link is kept only when it is an http(s) or mailto address. */
export function safeHref(raw: string): string | null {
  const v = raw.replace(/[\u0000-\u001f\u007f\s]+/g, "").trim();
  if (/^(https?:\/\/|mailto:)/i.test(v) && v.length <= 2000) return v;
  return null;
}

function attrOf(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

export function sanitizeDescriptionHtml(input: string | null | undefined): string {
  if (!input) return "";
  const html = String(input).replace(/<!--[\s\S]*?-->/g, "");
  const tokenRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<|[^<]+/g;
  const out: string[] = [];
  const stack: string[] = [];
  let skipUntil: string | null = null;
  let skipDepth = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html))) {
    const tok = m[0];
    const name = m[1]?.toLowerCase();
    if (!name) {
      if (skipUntil) continue;
      out.push(escapeText(tok === "<" ? "&lt;" : tok).replace(/&amp;lt;/g, "&lt;"));
      continue;
    }
    const closing = tok.startsWith("</");
    if (skipUntil) {
      if (name === skipUntil) { if (closing) { skipDepth -= 1; if (skipDepth === 0) skipUntil = null; } else skipDepth += 1; }
      continue;
    }
    if (DROP_CONTENT.has(name)) { if (!closing && !tok.endsWith("/>")) { skipUntil = name; skipDepth = 1; } continue; }
    const tag = ALIAS[name] ?? name;
    if (!ALLOWED.has(tag)) continue; // unknown tag: drop the tag, keep its text
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at === -1) continue;
      while (stack.length > at) out.push(`</${stack.pop()}>`);
      continue;
    }
    if (VOID.has(tag)) { out.push("<br>"); continue; }
    const attrs = m[2] ?? "";
    let extra = "";
    if (tag === "a") {
      const href = safeHref(attrOf(attrs, "href") ?? "");
      if (!href) continue; // a link with no safe address is just its text
      extra = ` href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow"`;
    } else if (tag === "p" || tag === "h2" || tag === "h3" || tag === "li") {
      const align = ALIGN.exec(attrOf(attrs, "style") ?? "")?.[1]?.toLowerCase() ?? (/^(left|center|right|justify)$/i.exec(attrOf(attrs, "align") ?? "")?.[1]?.toLowerCase());
      if (align && align !== "left") extra = ` style="text-align:${align}"`;
    }
    stack.push(tag);
    out.push(`<${tag}${extra}>`);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("").replace(/<(p|h2|h3|li)(?: [^>]*)?>\s*(?:<br>)?\s*<\/\1>/g, "").trim();
}

/** The description as plain text (tags removed, entities for the common characters decoded). */
export function descriptionToPlainText(html: string | null | undefined): string {
  return sanitizeDescriptionHtml(html)
    .replace(/<\/(p|h2|h3|li)>/g, " ")
    .replace(/<br>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function descriptionCharCount(html: string | null | undefined): number {
  return descriptionToPlainText(html).length;
}

/** Plain text (older descriptions) as paragraphs, so the editor and the product page can show it. */
export function plainToDescriptionHtml(text: string | null | undefined): string {
  const t = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return "";
  return t.split(/\n{2,}/).map((para) => `<p>${escapeText(para).replace(/\n/g, "<br>")}</p>`).join("");
}
