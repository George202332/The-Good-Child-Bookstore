"use server";

import { authEither as auth } from "@/lib/auth-either";
import { prisma } from "@/lib/prisma";
import { getSavedMockups, makeMockupPng, specFromBook } from "@/lib/mockup/store";
import { mockupWebp, onLightBackground } from "@/lib/mockup/render";
import { WrapError } from "@/lib/mockup/wrap";
import { mockupHash, type MockupSpec } from "@/lib/mockup/spec";
import { descriptionToPlainText } from "@/lib/description-html";

/**
 * The author's Print tab: the two previews, made from what is currently typed in the form, and the high-quality download.
 * Only signed-in authors (and the admin) can use it. The front cover must be a picture stored on this site.
 */

export interface PreviewInput {
  format: "paperback" | "hardcover";
  title: string;
  author: string;
  description: string;
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
    description: clip(i.description, 2400),
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

/** The high-quality picture (PNG, 1600 x 2400) for promotion: transparent, or on a plain light background. */
export async function downloadPrintMockup(input: PreviewInput, background: "transparent" | "light" = "transparent"): Promise<{ ok: boolean; png?: string; fileName?: string; error?: string }> {
  if (!(await allowed())) return { ok: false, error: "Sign in as an author to download." };
  try {
    const spec = toSpec(input);
    let png = await makeMockupPng(spec, input.frontCoverImageUrl);
    if (background === "light") png = await onLightBackground(png);
    const slug = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "book";
    return { ok: true, png: png.toString("base64"), fileName: `${slug}-${spec.format}-mockup${background === "light" ? "-light" : "-transparent"}.png` };
  } catch (e) {
    console.error("[mockup] download failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof WrapError ? e.message : "The picture could not be made just now." };
  }
}


/* ---------------------------------------------------------------------------------------------------------------------
 * SAVED ARTWORK on the edit screen.
 *
 * A published book's pictures are made once and kept. Opening the edit screen just SHOWS the saved picture; a picture is
 * made again only when something that affects it changes (new front cover, page count, trim size, binding, title,
 * author name, finish, colours ...), which is exactly what the settings code (hash) captures.
 *
 * Two separate shelves, so customers never see an unapproved draft:
 *   - the LIVE picture (key print_mockups:<book>), made when the book is approved and shown to customers;
 *   - the DRAFT picture (key print_mockups_draft:<book>), made while the author edits and shown only on the edit screen.
 * Approving an edit rebuilds the live picture from the approved book (lib/mockup/store.ts), as before.
 * ------------------------------------------------------------------------------------------------------------------- */
const draftKey = (bookId: string) => `print_mockups_draft:${bookId}`;
interface DraftEntry { id: string; hash: string }
type Draft = Partial<Record<"paperback" | "hardcover", DraftEntry>>;

async function ownsBook(bookId: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  if (session.user.role === "ADMIN") return true;
  const row = await prisma.book.findFirst({ where: { id: bookId, author: { userId: session.user.id } }, select: { id: true } });
  return !!row;
}

/** The saved picture that matches exactly what the form now holds, or null when it has to be made. Never makes anything. */
export async function savedPrintMockup(input: PreviewInput, bookId: string): Promise<{ url: string | null }> {
  if (!(await allowed()) || !/^[A-Za-z0-9_-]{1,64}$/.test(bookId) || !(await ownsBook(bookId))) return { url: null };
  try {
    const spec = toSpec(input);
    const hash = mockupHash(spec, input.frontCoverImageUrl ?? "");
    // 1. The draft picture made on an earlier visit with these very settings.
    const row = await prisma.setting.findUnique({ where: { key: draftKey(bookId) } });
    const draft = (row?.value as Draft | null) ?? {};
    if (draft[spec.format]?.hash === hash) return { url: `/api/images/${draft[spec.format]!.id}?w=960` };
    // 2. The live picture, when the form still holds exactly what the live book holds.
    const live = (await getSavedMockups(bookId))[spec.format];
    if (live?.id) {
      const book = await prisma.book.findUnique({
        where: { id: bookId },
        select: { id: true, title: true, description: true, coverImageUrl: true, hasPrint: true, paperbackPrice: true, hardcoverPrice: true, submissionMetadata: true, author: { select: { penName: true, user: { select: { name: true } } } } },
      });
      const built = book ? specFromBook(spec.format, book) : null;
      if (built && JSON.stringify(built.spec) === JSON.stringify({ ...spec, description: descriptionToPlainText(input.description).slice(0, 2400) }) && (built.coverUrl ?? "") === (input.frontCoverImageUrl ?? "")) {
        return { url: `/api/images/${live.id}?w=960` };
      }
    }
  } catch (e) {
    console.error("[mockup] saved lookup failed:", e instanceof Error ? e.message : e);
  }
  return { url: null };
}

/** Keeps the draft picture just made, replacing the earlier draft of the same format (one per format per book, never piling up). */
export async function keepDraftMockup(input: PreviewInput, bookId: string, image: string): Promise<void> {
  try {
    if (!(await allowed()) || !/^[A-Za-z0-9_-]{1,64}$/.test(bookId) || !(await ownsBook(bookId))) return;
    const m = image.match(/^data:image\/webp;base64,(.+)$/);
    if (!m) return;
    const spec = toSpec(input);
    const hash = mockupHash(spec, input.frontCoverImageUrl ?? "");
    const row = await prisma.setting.findUnique({ where: { key: draftKey(bookId) } });
    const draft = { ...((row?.value as Draft | null) ?? {}) };
    if (draft[spec.format]?.hash === hash) return;
    const saved = await prisma.uploadedImage.create({ data: { data: new Uint8Array(Buffer.from(m[1], "base64")), mimeType: "image/webp" }, select: { id: true } });
    if (draft[spec.format]) await prisma.uploadedImage.deleteMany({ where: { id: draft[spec.format]!.id } }).catch(() => undefined);
    draft[spec.format] = { id: saved.id, hash };
    const value = JSON.parse(JSON.stringify(draft));
    await prisma.setting.upsert({ where: { key: draftKey(bookId) }, update: { value }, create: { key: draftKey(bookId), value } });
  } catch (e) {
    console.error("[mockup] keeping the draft picture failed:", e instanceof Error ? e.message : e);
  }
}
