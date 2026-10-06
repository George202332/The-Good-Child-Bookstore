/**
 * Validation for the Responsive Preview tool's free-text path box.
 * Only same-origin public site paths may be previewed: it must start
 * with a single "/", must not point at a backend area, and must not
 * contain anything that could resolve to another site or another path
 * (a protocol, "//", a backslash, ".." segments, or encoded versions
 * of those).
 */
const BLOCKED_PREFIXES = ["/admin", "/investor", "/editor"];

export type PreviewPathResult = { ok: true; path: string } | { ok: false; error: string };

export function validatePreviewPath(input: string): PreviewPathResult {
  const path = input.trim();
  if (!path) return { ok: false, error: "Enter a path such as /bookshelf." };
  if (!path.startsWith("/")) return { ok: false, error: "The path must start with a single slash, for example /blog." };
  if (path.includes("//")) return { ok: false, error: "Double slashes are not allowed." };
  if (/[a-z][a-z0-9+.-]*:/i.test(path)) return { ok: false, error: "Full web addresses are not allowed. Use a path on this site only." };
  if (/[\\\s\u0000-\u001f]/.test(path)) return { ok: false, error: "The path contains characters that are not allowed." };
  if (/%(2f|5c|2e)/i.test(path)) return { ok: false, error: "Encoded slashes and dots are not allowed." };
  const pathOnly = path.split(/[?#]/)[0];
  if (pathOnly.split("/").some((seg) => seg === "..")) return { ok: false, error: "Parent folder segments (..) are not allowed." };
  const lower = pathOnly.toLowerCase();
  if (BLOCKED_PREFIXES.some((p) => lower.startsWith(p))) {
    return { ok: false, error: "Backend areas cannot be previewed here. Use a public page path." };
  }
  return { ok: true, path };
}
