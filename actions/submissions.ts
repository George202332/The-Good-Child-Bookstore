"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Real book submission — a much fuller port of the original's actual
 * submission form (collectSubmissionFormData(), the-good-child-bookstore
 * _54_1.html:10651-10689), covering every field it collected: basic
 * info, contributors, edition/series, categorization, educational
 * details, pricing/rights, marketing toggles, SEO, and format-specific
 * fields (ISBN/file type for eBook, trim size for print, narrator for
 * audiobook). Creates a genuine Book row, entering the same Draft →
 * Pending Review workflow as everything else in the editorial system.
 *
 * Still not replicated from the original: the live print-cover-wrap
 * preview and the full Lulu print-configuration UI (trim/paper/binding/
 * finish pickers, EAN-13 barcode rendering) — that's a real, separate,
 * much larger feature (see LULU_CONFIG in the original file) that isn't
 * built yet. Cover image is a real upload (converted to WebP), not a
 * file-to-dataURL simulation.
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

/** Everything from the original form that doesn't have its own Book
 * column — stored as JSON (Book.submissionMetadata). */
export interface SubmissionMetadata {
  authorFirstName: string;
  authorLastName: string;
  edition?: string;
  seriesName?: string;
  seriesNumber?: number;
  publisher?: string;
  copyrightYear?: number;
  coAuthors?: string;
  illustrator?: string;
  editor?: string;
  translator?: string;
  authorBio?: string;
  subgenre?: string;
  readingLevel?: string;
  schoolGrade?: string;
  curriculum?: string;
  learningObjectives?: string;
  educationalBenefits?: string;
  discountPrice?: number;
  promoPrice?: number;
  currency: string;
  taxSetting: string;
  worldwideRights: boolean;
  countryRestrictions?: string;
  copyrightHolder?: string;
  licenseType: string;
  sellOnStore: boolean;
  includeInPromotions: boolean;
  featuredRequest: boolean;
  allowDiscounts: boolean;
  allowBundles: boolean;
  affiliateEnabled: boolean;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  fileType?: string;
  trimSize?: string;
  narrator?: string;
}

export interface SubmitBookInput {
  title: string;
  subtitle?: string;
  description: string;
  backCoverDescription?: string;
  price: number;
  ageGroup: string;
  genre: string;
  language: string;
  coverImageUrl?: string;
  formats: { ebook: boolean; print: boolean; audiobook: boolean };
  metadata: SubmissionMetadata;
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
      subtitle: input.subtitle?.trim() || null,
      slug,
      description: input.backCoverDescription?.trim() || input.description.trim(),
      isbn: input.formats.ebook || input.formats.print ? generateIsbn() : null,
      price: input.price,
      status: input.submitForReview ? "PENDING_REVIEW" : "DRAFT",
      authorId: user.authorProfile.id,
      ageGroup: input.ageGroup,
      language: input.language || "en",
      coverImageUrl: input.coverImageUrl?.trim() || null,
      hasEbook: input.formats.ebook,
      hasPrint: input.formats.print,
      hasAudiobook: input.formats.audiobook,
      submissionMetadata: JSON.parse(JSON.stringify(input.metadata)),
    },
  });

  revalidatePath("/account/books");
  return { ok: true, bookId: book.id };
}
