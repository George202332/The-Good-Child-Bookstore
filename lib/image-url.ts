/**
 * Uploaded pictures live at /api/images/<id>. The image route can hand back a
 * smaller copy of the same picture (?w=480) so a small card never has to
 * download a 2000-pixel original. The widths allowed here are the only ones the
 * route accepts, which keeps the number of cached variants small.
 */
export const IMAGE_WIDTHS = [24, 240, 480, 640, 960, 1280, 1600] as const;

const UPLOADED = /^\/api\/images\/[A-Za-z0-9_-]+$/;

export function isUploadedImage(url: string | null | undefined): url is string {
  return !!url && UPLOADED.test(url);
}

/** The same picture at a given width (only for our own uploaded pictures). */
export function imageAtWidth(url: string, width: number): string {
  return isUploadedImage(url) ? `${url}?w=${width}` : url;
}

/** src / srcSet for an <img>: the browser picks the smallest copy that is sharp enough. */
export function responsiveImage(url: string, widths: readonly number[]): { src: string; srcSet?: string } {
  if (!isUploadedImage(url)) return { src: url };
  const sorted = [...widths].sort((a, b) => a - b);
  return {
    src: imageAtWidth(url, sorted[Math.min(1, sorted.length - 1)]),
    srcSet: sorted.map((w) => `${imageAtWidth(url, w)} ${w}w`).join(", "),
  };
}

/** Parses the ?w= value the image route receives; null means "send the original". */
export function parseRequestedWidth(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return (IMAGE_WIDTHS as readonly number[]).includes(n) ? n : null;
}
