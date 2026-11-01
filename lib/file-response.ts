/**
 * Headers for serving an uploaded file inline.
 *
 * The original file name goes into the Content-Disposition header. HTTP headers can only carry plain
 * Latin-1 text, so a name with an en dash, curly quotes, an emoji or any non-Latin letter used to make the
 * server throw while building the response, and the route answered 500 (for the browser's inline preview and
 * for Lulu's file check alike). The name is now sent twice, the way browsers and download clients expect: a
 * safe plain fallback in `filename`, and the exact name, percent-encoded, in `filename*`.
 */
export function inlineContentDisposition(name: string | null | undefined): string {
  const original = (name ?? "").replace(/[\r\n]+/g, " ").trim() || "file";
  const fallback = original.replace(/[^\x20-\x7e]/g, "_").replace(/["\\%]/g, "_");
  const encoded = encodeURIComponent(original).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
