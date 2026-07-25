export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Builds a real <urlset> sitemap XML document from a list of URL
 * entries — shared by every sub-sitemap route (books/blogs/authors/
 * static) so each one stays a few lines of actual content. */
export function buildUrlsetXml(entries: SitemapUrlEntry[]): string {
  const items = entries
    .map((e) => {
      const parts = [`    <loc>${xmlEscape(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (e.priority !== undefined) parts.push(`    <priority>${e.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>`;
}

/** Builds a <sitemapindex> document listing the sub-sitemaps —
 * sitemap.xml itself becomes this index rather than one giant flat file,
 * so crawlers can prioritize (e.g. re-crawl sitemap-books.xml more often
 * than sitemap-static.xml). */
export function buildSitemapIndexXml(sitemapUrls: string[]): string {
  const items = sitemapUrls.map((u) => `  <sitemap>\n    <loc>${xmlEscape(u)}</loc>\n  </sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>`;
}

export const XML_HEADERS = { "Content-Type": "application/xml" };
