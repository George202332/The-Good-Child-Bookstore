"use server";

import { authEither as auth } from "@/lib/auth-either";
import { makeMockupPng } from "@/lib/mockup/store";
import { mockupWebp } from "@/lib/mockup/render";
import { WrapError } from "@/lib/mockup/wrap";
import type { MockupSpec } from "@/lib/mockup/spec";

/**
 * The author's Print tab: the two previews, made from what is currently typed in the form, and the high-quality download.
 * Only signed-in authors (and the admin) can use it. The front cover must be a picture stored on this site.
 */

export interface PreviewInput {
  format: "paperback" | "hardcover";
  title: string;
  author: string;
  description: string;
  isbn?: string;
  frontCoverImageUrl?: string;
  trimCode: string;
  pages: number;
  paperCode: string;
  finish: string;
  linenColor: string;
  foilColor: string;
  foilTitle?: string;
  foilAuthor?: string;
  /** The author's own full-wrap cover PDF (stored file id), when the Print tab is using it. */
  customCoverFileId?: string;
}

function toSpec(i: PreviewInput): MockupSpec {
  const clip = (v: string | undefined, n: number) => (v ?? "").toString().slice(0, n);
  return {
    format: i.format === "hardcover" ? "hardcover" : "paperback",
    title: clip(i.title, 200) || "Your Book Title",
    author: clip(i.author, 120),
    description: clip(i.description, 700),
    isbn: clip(i.isbn, 20) || null,
    trimCode: /^\d{4}X\d{4}$/.test(i.trimCode) ? i.trimCode : "0600X0900",
    pages: Number.isFinite(i.pages) && i.pages > 0 && i.pages < 2000 ? Math.round(i.pages) : 32,
    paperCode: clip(i.paperCode, 12),
    finish: i.finish === "G" ? "G" : "M",
    linenColor: i.format === "hardcover" ? clip(i.linenColor, 1) || "N" : "X",
    foilColor: i.format === "hardcover" ? clip(i.foilColor, 1) || "X" : "X",
    foilTitle: i.format === "hardcover" ? clip(i.foilTitle, 60) : "",
    foilAuthor: i.format === "hardcover" ? clip(i.foilAuthor, 40) : "",
    wrapFileId: /^[A-Za-z0-9_-]{1,64}$/.test(i.customCoverFileId ?? "") ? (i.customCoverFileId as string) : null,
  };
}

async function allowed(): Promise<boolean> {
  const session = await auth();
  const role = session?.user?.role;
  return role === "AUTHOR" || role === "ADMIN";
}

/** A web-sized preview as a data address (WebP). */
export async function previewPrintMockup(input: PreviewInput): Promise<{ ok: boolean; image?: string; error?: string }> {
  if (!(await allowed())) return { ok: false, error: "Sign in as an author to see the preview." };
  try {
    const png = await makeMockupPng(toSpec(input), input.frontCoverImageUrl);
    const webp = await mockupWebp(png);
    return { ok: true, image: `data:image/webp;base64,${webp.toString("base64")}` };
  } catch (e) {
    console.error("[mockup] preview failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof WrapError ? e.message : "The preview could not be made just now." };
  }
}

/** The high-quality picture (PNG, 1200 x 1800) for promotion. */
export async function downloadPrintMockup(input: PreviewInput): Promise<{ ok: boolean; png?: string; fileName?: string; error?: string }> {
  if (!(await allowed())) return { ok: false, error: "Sign in as an author to download." };
  try {
    const spec = toSpec(input);
    const png = await makeMockupPng(spec, input.frontCoverImageUrl);
    const slug = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "book";
    return { ok: true, png: png.toString("base64"), fileName: `${slug}-${spec.format}-mockup.png` };
  } catch (e) {
    console.error("[mockup] download failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof WrapError ? e.message : "The picture could not be made just now." };
  }
}
