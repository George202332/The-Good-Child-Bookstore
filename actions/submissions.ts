"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Real book submission — creates an actual Book row (status DRAFT or
 * PENDING_REVIEW, same workflow as everything else in the editorial
 * system) with format flags for eBook/print/audiobook. This is a
 * streamlined version of the original's much larger submission flow
 * (which included a step-by-step checklist, live cover-wrap preview,
 * auto-generated ISBN, and direct file uploads for manuscript/cover/
 * sample pages) — those file-upload pieces need real file storage
 * (e.g. S3/Cloudinary) wired in to work properly server-side, which
 * isn't set up yet, so this version takes a cover image URL instead of
 * an upload. The core result is the same: a real book, in the real
 * database, going through the real approval workflow.
 */

/** Ported from ean13CheckDigit()/ensureGeneratedISBN() (the-good-child-bookstore_54_1.html:8336-8341). */
function generateIsbn(): string {
  const first12 = [9, 7, 8, 1, ...Array.from({ length: 8 }, () => Math.floor(Math.random() * 10))];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += first12[i] * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return `978-1-${first12.slice(4, 9).join("")}-${first12.slice(9, 12).join("")}-${check}`;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "book"
  );
}

export interface SubmitBookInput {
  title: string;
  description: string;
  price: number;
  ageGroup: string;
  language: string;
  formats: { ebook: boolean; print: boolean; audiobook: boolean };
  coverImageUrl?: string;
  submitForReview: boolean;
}

export async function submitBook(input: SubmitBookInput): Promise<{ ok: boolean; error?: string; bookId?: string }> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") {
    return { ok: false, error: "Only author accounts can submit books." };
  }
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (!input.description.trim()) return { ok: false, error: "Description is required." };
  if (input.price <= 0) return { ok: false, error: "Price must be greater than $0." };
  if (!input.formats.ebook && !input.formats.print && !input.formats.audiobook) {
    return { ok: false, error: "Select at least one format (eBook, print, or audiobook)." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { authorProfile: true } });
  if (!user?.authorProfile) return { ok: false, error: "Author profile not found." };

  const baseSlug = slugify(input.title);
  let slug = baseSlug;
  let attempt = 1;
  while (await prisma.book.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++attempt}`;
  }

  const book = await prisma.book.create({
    data: {
      title: input.title.trim(),
      slug,
      description: input.description.trim(),
      isbn: generateIsbn(),
      price: input.price,
      status: input.submitForReview ? "PENDING_REVIEW" : "DRAFT",
      authorId: user.authorProfile.id,
      ageGroup: input.ageGroup,
      language: input.language || "en",
      coverImageUrl: input.coverImageUrl?.trim() || null,
      hasEbook: input.formats.ebook,
      hasPrint: input.formats.print,
      hasAudiobook: input.formats.audiobook,
    },
  });

  revalidatePath("/account/books");
  return { ok: true, bookId: book.id };
}
