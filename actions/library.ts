"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/actions/site-settings";
import { getPagesContent } from "@/actions/page-content";

/**
 * The whole-site media library — every image and file uploaded
 * anywhere, organized into real folders: eBooks, Paperbacks,
 * Hardcovers, Audiobooks, Images (book covers + anything else tied to
 * a book), and Admin (logo/favicon/badges/banners — anything not tied
 * to a specific book). Since raw uploaded images don't carry a label
 * saying what they're used for, folder assignment works by
 * cross-referencing every real source of truth that references an
 * uploaded image/file's id (Book.coverImageUrl, BookFile rows, and
 * every image field in Site Settings/Page Content) — not guessed.
 */

export type LibraryFolder = "ebooks" | "paperbacks" | "hardcovers" | "audiobooks" | "images" | "admin" | "unsorted";

export interface LibraryItem {
  id: string;
  kind: "image" | "file";
  mimeType: string;
  name: string;
  createdAt: Date;
  folder: LibraryFolder;
  url: string;
}

function extractId(url: string | undefined, prefix: string): string | null {
  if (!url || !url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Not authorized.");
}

export async function listLibrary(): Promise<LibraryItem[]> {
  await requireAdmin();

  const [images, files, bookFiles, books, settings, pagesContent] = await Promise.all([
    prisma.uploadedImage.findMany({ select: { id: true, mimeType: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.uploadedFile.findMany({ select: { id: true, mimeType: true, originalName: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.bookFile.findMany({
      select: { id: true, kind: true, url: true, createdAt: true, book: { select: { title: true, hasEbook: true, hasPrint: true, paperbackPrice: true, hardcoverPrice: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.book.findMany({ select: { coverImageUrl: true, title: true } }),
    getSiteSettings(),
    getPagesContent(),
  ]);

  // Every uploaded-file id that's actually referenced by a BookFile row
  // (manuscript/print-ready PDFs, promotional images, etc) — used to
  // avoid double-listing the same underlying file under both "Files"
  // and a book folder.
  const bookFileUnderlyingIds = new Set(
    (bookFiles as { url: string }[]).map((bf) => extractId(bf.url, "/api/files/")).filter((id): id is string => !!id)
  );

  // Every uploaded-image id known to be a book cover.
  const coverImageIds = new Set(
    (books as { coverImageUrl: string | null }[]).map((b) => extractId(b.coverImageUrl ?? undefined, "/api/images/")).filter((id): id is string => !!id)
  );

  // Every uploaded-image id known to be an admin-managed image.
  const adminImageIds = new Set(
    [
      settings.logoImageUrl,
      settings.faviconImageUrl,
      settings.paymentBadges.mpesa,
      settings.paymentBadges.mastercard,
      settings.paymentBadges.visa,
      settings.paymentBadges.amex,
      settings.paymentBadges.verve,
      pagesContent.home.heroImage,
      pagesContent.home.bookClubBannerImage,
      pagesContent.home.printBannerImage,
      pagesContent.home.affiliateBannerImage,
      pagesContent.home.journalBannerImage,
    ]
      .map((u) => extractId(u, "/api/images/"))
      .filter((id): id is string => !!id)
  );

  const items: LibraryItem[] = [];

  for (const img of images as { id: string; mimeType: string; createdAt: Date }[]) {
    let folder: LibraryFolder = "unsorted";
    if (coverImageIds.has(img.id)) folder = "images";
    else if (adminImageIds.has(img.id)) folder = "admin";
    items.push({ id: img.id, kind: "image", mimeType: img.mimeType, name: `Image ${img.id.slice(0, 8)}`, createdAt: img.createdAt, folder, url: `/api/images/${img.id}` });
  }

  for (const f of files as { id: string; mimeType: string; originalName: string; createdAt: Date }[]) {
    if (bookFileUnderlyingIds.has(f.id)) continue; // shown via its BookFile entry below instead
    items.push({ id: f.id, kind: "file", mimeType: f.mimeType, name: f.originalName, createdAt: f.createdAt, folder: "admin", url: `/api/files/${f.id}` });
  }

  for (const bf of bookFiles as { id: string; kind: string; url: string; createdAt: Date; book: { title: string; hasEbook: boolean; hasPrint: boolean; paperbackPrice: unknown; hardcoverPrice: unknown } }[]) {
    if (bf.kind === "PROMOTIONAL") {
      const imgId = extractId(bf.url, "/api/images/");
      if (imgId) continue; // already listed as an image above
    }
    let folder: LibraryFolder = "unsorted";
    if (bf.kind === "MANUSCRIPT") {
      if (bf.book.hasPrint && bf.book.paperbackPrice != null) folder = "paperbacks";
      else if (bf.book.hasPrint && bf.book.hardcoverPrice != null) folder = "hardcovers";
      else if (bf.book.hasEbook) folder = "ebooks";
    }
    items.push({ id: bf.id, kind: "file", mimeType: "application/pdf", name: `${bf.book.title} — ${bf.kind.toLowerCase()}`, createdAt: bf.createdAt, folder, url: bf.url });
  }

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function uploadToAdminLibrary(formData: FormData): Promise<{ ok: boolean; error?: string; count?: number }> {
  await requireAdmin();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { ok: false, error: "No files selected." };

  let count = 0;
  for (const file of files) {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (file.type.startsWith("image/")) {
      const sharp = (await import("sharp")).default;
      try {
        const webp = await sharp(Buffer.from(buf)).resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
        await prisma.uploadedImage.create({ data: { data: new Uint8Array(webp), mimeType: "image/webp" } });
        count++;
        continue;
      } catch {
        // Falls through to generic file storage if it can't be processed as an image.
      }
    }
    await prisma.uploadedFile.create({ data: { data: buf, mimeType: file.type || "application/octet-stream", originalName: file.name } });
    count++;
  }
  revalidatePath("/admin/library");
  return { ok: true, count };
}

export async function deleteLibraryItems(items: { id: string; kind: "image" | "file" }[]): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const imageIds = items.filter((i) => i.kind === "image").map((i) => i.id);
  const fileIds = items.filter((i) => i.kind === "file").map((i) => i.id);
  if (imageIds.length > 0) await prisma.uploadedImage.deleteMany({ where: { id: { in: imageIds } } });
  if (fileIds.length > 0) {
    // A file id here might be a BookFile row (a book's manuscript/etc)
    // or a raw UploadedFile — try both, whichever actually matches.
    await prisma.bookFile.deleteMany({ where: { id: { in: fileIds } } });
    await prisma.uploadedFile.deleteMany({ where: { id: { in: fileIds } } });
  }
  revalidatePath("/admin/library");
  return { ok: true };
}
