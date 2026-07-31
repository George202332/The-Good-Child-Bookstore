"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Real book submission — a full port of the original's submission form
 * (collectSubmissionFormData()), rebuilt to match the exact reference
 * design provided (11 numbered sections: Book information, Author
 * information, Book classification, Book description, Files, Pricing,
 * Distribution, Rights, SEO, Preview, Submission checklist). Creates a
 * genuine Book row plus BookFile rows for the manuscript/sample-pages/
 * promotional-image uploads, entering the same Draft → Pending Review
 * workflow as everything else.
 *
 * Still not replicated: the live print-cover-wrap preview and the full
 * Lulu print-configuration UI's actual API call (the configuration
 * fields themselves — trim/paper/binding/finish — are built, see
 * lib/lulu-config.ts) — a real, separate, larger feature.
 */

/** Ported from ean13CheckDigit()/ensureGeneratedISBN() (the-good-child-bookstore_54_1.html:8336-8341) — used only as a fallback when the author doesn't provide their own ISBN. */
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

export interface MarketplaceLinks {
  amazon?: string;
  appleBooks?: string;
  google?: string;
  barnesNoble?: string;
  kobo?: string;
  overdrive?: string;
}

/** Everything from the form that doesn't have its own Book column —
 * stored as JSON (Book.submissionMetadata). */
export interface SubmissionMetadata {
  authorFirstName: string;
  authorLastName: string;
  edition?: string;
  seriesName?: string;
  seriesNumber?: number;
  publisher?: string;
  publicationDate?: string;
  originalPublicationDate?: string;
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
  longDescriptionHtml?: string;
  backCoverDescription?: string;
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
  marketplaceLinks?: MarketplaceLinks;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string;
  fileType?: string;
  narrator?: string;
  // Real Lulu print-configuration fields (see lib/lulu-config.ts) — only
  // meaningful when the print format is enabled.
  interiorColor?: string;
  printQuality?: string;
  binding?: string;
  paperType?: string;
  coverFinish?: string;
  linenColor?: string;
  foilColor?: string;
  trimSizeCode?: string;
  podPackageId?: string;
  // Print-specific fields (Submit a print copy) — matches the exact
  // reference design: dual paperback/hardcover editions, shipping/
  // contact details required by Lulu's Print API, foil stamp text, and
  // print-specific distribution toggles.
  paperbackEnabled?: boolean;
  hardcoverEnabled?: boolean;
  paperbackRetailPrice?: number;
  hardcoverRetailPrice?: number;
  foilStampTitleText?: string;
  foilStampAuthorText?: string;
  printReadyPdfFileId?: string;
  frontCoverImageUrl?: string;
  customBackCoverPdfFileId?: string;
  /** Which cover goes to Lulu: "auto" sends the auto-generated wraparound
   * (front cover + generated spine/back), "custom" sends the author's
   * own uploaded complete wraparound PDF instead. Set automatically by
   * whichever of the two cover uploads the author actually used most
   * recently — matches the original's own backCoverMode behavior. */
  backCoverMode?: "auto" | "custom";
  contactEmail?: string;
  streetAddress?: string;
  city?: string;
  countryCode?: string;
  stateRegionCode?: string;
  postalCode?: string;
  phoneNumber?: string;
  shippingLevel?: string;
  sellThroughWebsite?: boolean;
  luluGlobalDistribution?: boolean;
  privatePrinting?: boolean;
  affiliateEligiblePrint?: boolean;
  promotionalCampaignEligible?: boolean;
}

export interface SubmitBookInput {
  title: string;
  subtitle?: string;
  isbn?: string;
  description: string;
  price: number;
  ageGroup: string;
  category: string;
  genre: string;
  language: string;
  coverImageUrl?: string;
  manuscriptFileId?: string;
  samplePagesFileId?: string;
  promotionalImageUrls?: string[];
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
  if (!input.description.trim()) return { ok: false, error: "Short description is required." };
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

  const bookFiles: { kind: string; url: string }[] = [];
  if (input.manuscriptFileId) bookFiles.push({ kind: "MANUSCRIPT", url: `/api/files/${input.manuscriptFileId}` });
  if (input.samplePagesFileId) bookFiles.push({ kind: "SAMPLE", url: `/api/files/${input.samplePagesFileId}` });
  for (const url of input.promotionalImageUrls ?? []) bookFiles.push({ kind: "PROMOTIONAL", url });

  const [category, genre] = await Promise.all([
    prisma.category.upsert({ where: { name: input.category }, update: {}, create: { name: input.category } }),
    prisma.genre.upsert({ where: { name: input.genre }, update: {}, create: { name: input.genre } }),
  ]);

  const book = await prisma.book.create({
    data: {
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      slug,
      description: input.description.trim(),
      isbn: input.isbn?.trim() || (input.formats.ebook || input.formats.print ? generateIsbn() : null),
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
      files: bookFiles.length > 0 ? { create: bookFiles } : undefined,
      categories: { create: [{ categoryId: category.id }] },
      genres: { create: [{ genreId: genre.id }] },
    },
  });

  revalidatePath("/account/books");
  return { ok: true, bookId: book.id };
}

export interface UpdateBookInput {
  bookId: string;
  title: string;
  subtitle?: string;
  description: string;
  price: number;
  ageGroup: string;
  category: string;
  genre: string;
  language: string;
  coverImageUrl?: string;
  formats: { ebook: boolean; print: boolean; audiobook: boolean };
}

/**
 * Edits an existing book's core details and resubmits it for review —
 * per explicit instruction, any edit sends the book back through
 * moderation rather than silently updating a live listing. Scoped to
 * the book's core fields (title, description, pricing, category,
 * formats) rather than reproducing every field of the original
 * multi-format submission wizard (ISBN, manuscript re-upload, POD
 * specs) — those stay as originally submitted.
 */
export async function updateBook(input: UpdateBookInput): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return { ok: false, error: "Only author accounts can edit books." };
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (!input.description.trim()) return { ok: false, error: "Short description is required." };
  if (input.price <= 0) return { ok: false, error: "Price must be greater than $0." };
  if (!input.formats.ebook && !input.formats.print && !input.formats.audiobook) {
    return { ok: false, error: "Select at least one format (eBook, print, or audiobook)." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { authorProfile: true } });
  if (!user?.authorProfile) return { ok: false, error: "Author profile not found." };

  const book = await prisma.book.findUnique({ where: { id: input.bookId } });
  if (!book || book.authorId !== user.authorProfile.id) return { ok: false, error: "Book not found." };

  const [category, genre] = await Promise.all([
    prisma.category.upsert({ where: { name: input.category }, update: {}, create: { name: input.category } }),
    prisma.genre.upsert({ where: { name: input.genre }, update: {}, create: { name: input.genre } }),
  ]);

  await prisma.$transaction([
    prisma.categoryOnBook.deleteMany({ where: { bookId: input.bookId } }),
    prisma.genreOnBook.deleteMany({ where: { bookId: input.bookId } }),
    prisma.book.update({
      where: { id: input.bookId },
      data: {
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || null,
        description: input.description.trim(),
        price: input.price,
        ageGroup: input.ageGroup,
        language: input.language || "en",
        coverImageUrl: input.coverImageUrl?.trim() || null,
        hasEbook: input.formats.ebook,
        hasPrint: input.formats.print,
        hasAudiobook: input.formats.audiobook,
        status: "PENDING_REVIEW",
        categories: { create: [{ categoryId: category.id }] },
        genres: { create: [{ genreId: genre.id }] },
      },
    }),
  ]);

  revalidatePath("/account/books");
  revalidatePath(`/account/books/${input.bookId}/edit`);
  return { ok: true };
}

/** Removes a book from the store shelf (or restores it) without
 * deleting anything — sets status to ARCHIVED, which every public
 * listing already filters out. */
export async function setBookSuspended(bookId: string, suspended: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return { ok: false, error: "Only author accounts can do this." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { authorProfile: true } });
  if (!user?.authorProfile) return { ok: false, error: "Author profile not found." };

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book || book.authorId !== user.authorProfile.id) return { ok: false, error: "Book not found." };

  await prisma.book.update({
    where: { id: bookId },
    data: { status: suspended ? "ARCHIVED" : "PENDING_REVIEW" },
  });

  revalidatePath("/account/books");
  return { ok: true };
}
