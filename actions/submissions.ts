"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canModerateContent } from "@/lib/roles";

export interface AuthorAliasRow {
  id: string;
  firstName: string;
  lastName: string;
}

/** Every pen name/display name this real author has used before —
 * powers the "Author" dropdown on new-title submission so they can
 * reuse a name instead of retyping it. */
export async function listMyAuthorAliases(): Promise<AuthorAliasRow[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "AUTHOR") return [];
  const profile = await prisma.authorProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return [];
  const aliases = await prisma.authorAlias.findMany({ where: { authorProfileId: profile.id }, orderBy: { createdAt: "asc" } });
  return aliases.map((a: { id: string; firstName: string; lastName: string }) => ({ id: a.id, firstName: a.firstName, lastName: a.lastName }));
}

/** Remembers a new pen name for future submissions — safe to call
 * every time a title is submitted; does nothing if this exact name is
 * already on file (see the unique constraint on AuthorAlias). */
export async function rememberAuthorAlias(firstName: string, lastName: string): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== "AUTHOR") return;
  if (!firstName.trim() || !lastName.trim()) return;
  const profile = await prisma.authorProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return;
  try {
    await prisma.authorAlias.upsert({
      where: { authorProfileId_firstName_lastName: { authorProfileId: profile.id, firstName: firstName.trim(), lastName: lastName.trim() } },
      update: {},
      create: { authorProfileId: profile.id, firstName: firstName.trim(), lastName: lastName.trim() },
    });
    revalidatePath("/account/books/new");
  } catch {
    // Non-critical — a failed remember shouldn't block the actual submission.
  }
}

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

/** eBook "SN" (serial number) — not a real ISBN, an internal
 * store-issued identifier: 13 digits, all numeric, always starting
 * with 5 so it's immediately distinguishable from a real ISBN-13
 * (which always starts with 978/979). Used only when the author
 * doesn't already have their own ISBN for the ebook. */
function generateSerialNumber(): string {
  let digits = "5";
  for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10);
  return digits;
}

/** Generates a genuinely unique SN, called on demand (not automatically)
 * from the "generate an SN for me" button — checks the database and
 * regenerates on any collision, so this is a real uniqueness guarantee,
 * not just a random guess that happens to rarely collide. */
export async function generateUniqueSerialNumber(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = generateSerialNumber();
    const existing = await prisma.book.findUnique({ where: { isbn: candidate } });
    if (!existing) return candidate;
  }
  // Vanishingly unlikely to ever reach this after 20 tries against a
  // 12-digit random space, but never return a value that wasn't
  // actually checked.
  throw new Error("Could not generate a unique SN — please try again.");
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "book"
  );
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
  currency?: string;
  taxSetting: string;
  worldwideRights: boolean;
  countryRestrictions?: string;
  copyrightHolder?: string;
  licenseType: string;
  sellOnStore: boolean;
  includeInPromotions?: boolean;
  featuredRequest: boolean;
  allowDiscounts?: boolean;
  allowBundles?: boolean;
  affiliateEnabled: boolean;
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
  coverAltText?: string;
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

  const authorFirstName = (input.metadata as { authorFirstName?: string }).authorFirstName;
  const authorLastName = (input.metadata as { authorLastName?: string }).authorLastName;
  if (authorFirstName?.trim() && authorLastName?.trim()) {
    try {
      await prisma.authorAlias.upsert({
        where: { authorProfileId_firstName_lastName: { authorProfileId: user.authorProfile.id, firstName: authorFirstName.trim(), lastName: authorLastName.trim() } },
        update: {},
        create: { authorProfileId: user.authorProfile.id, firstName: authorFirstName.trim(), lastName: authorLastName.trim() },
      });
    } catch {
      // Non-critical -- a failed remember shouldn't block the actual submission.
    }
  }

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

  const [category, genre, siteMode] = await Promise.all([
    prisma.category.upsert({ where: { name: input.category }, update: {}, create: { name: input.category } }),
    prisma.genre.upsert({ where: { name: input.genre }, update: {}, create: { name: input.genre } }),
    import("@/actions/test-data").then((m) => m.getSiteDataMode()),
  ]);

  const book = await prisma.book.create({
    data: {
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      slug,
      description: input.description.trim(),
      isbn: input.isbn?.trim() || (input.formats.print ? generateIsbn() : input.formats.ebook ? generateSerialNumber() : null),
      price: input.price,
      isTestData: siteMode === "test",
      status: input.submitForReview ? "PENDING_REVIEW" : "DRAFT",
      authorId: user.authorProfile.id,
      ageGroup: input.ageGroup,
      language: input.language || "en",
      coverImageUrl: input.coverImageUrl?.trim() || null,
      coverAltText: input.coverAltText?.trim() || null,
      hasEbook: input.formats.ebook,
      hasPrint: input.formats.print,
      hasAudiobook: input.formats.audiobook,
      paperbackPrice: input.formats.print && input.metadata.paperbackEnabled && input.metadata.paperbackRetailPrice
        ? input.metadata.paperbackRetailPrice
        : null,
      hardcoverPrice: input.formats.print && input.metadata.hardcoverEnabled && input.metadata.hardcoverRetailPrice
        ? input.metadata.hardcoverRetailPrice
        : null,
      submissionMetadata: JSON.parse(JSON.stringify(input.metadata)),
      files: bookFiles.length > 0 ? { create: bookFiles } : undefined,
      categories: { create: [{ categoryId: category.id }] },
      genres: { create: [{ genreId: genre.id }] },
    },
  });

  revalidatePath("/account/books");
  return { ok: true, bookId: book.id };
}

/**
 * Edits an existing book using the exact same full field set as
 * submitBook — manuscript, author name/alias, ISBN/SN, keywords, SEO
 * metadata, pricing, distribution, everything — per explicit
 * instruction that editing should be "the same exact page" as
 * submitting. Always resubmits for review on save, since any edit to
 * a book should go back through moderation rather than silently
 * updating a live listing.
 */
export async function updateBookFull(bookId: string, input: SubmitBookInput): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return { ok: false, error: "Only author accounts can edit books." };
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (!input.description.trim()) return { ok: false, error: "Description is required." };
  if (input.price <= 0) return { ok: false, error: "Price must be greater than $0." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { authorProfile: true } });
  if (!user?.authorProfile) return { ok: false, error: "Author profile not found." };

  const existing = await prisma.book.findUnique({ where: { id: bookId } });
  if (!existing || existing.authorId !== user.authorProfile.id) return { ok: false, error: "Book not found." };

  const authorFirstName = (input.metadata as { authorFirstName?: string }).authorFirstName;
  const authorLastName = (input.metadata as { authorLastName?: string }).authorLastName;
  if (authorFirstName?.trim() && authorLastName?.trim()) {
    try {
      await prisma.authorAlias.upsert({
        where: { authorProfileId_firstName_lastName: { authorProfileId: user.authorProfile.id, firstName: authorFirstName.trim(), lastName: authorLastName.trim() } },
        update: {},
        create: { authorProfileId: user.authorProfile.id, firstName: authorFirstName.trim(), lastName: authorLastName.trim() },
      });
    } catch {
      // Non-critical -- a failed remember shouldn't block the actual save.
    }
  }

  const bookFiles: { kind: string; url: string }[] = [];
  if (input.manuscriptFileId) bookFiles.push({ kind: "MANUSCRIPT", url: `/api/files/${input.manuscriptFileId}` });
  if (input.samplePagesFileId) bookFiles.push({ kind: "SAMPLE", url: `/api/files/${input.samplePagesFileId}` });
  for (const url of input.promotionalImageUrls ?? []) bookFiles.push({ kind: "PROMOTIONAL", url });

  if (existing.status === "PUBLISHED") {
    // The book is currently live and visible to customers — none of
    // that changes yet. The proposed edit is stored as a pending
    // revision instead of touching any real field, so the book stays
    // exactly as it is, with its current details, until an admin
    // approves the revision (see approveBookRevision below).
    await prisma.book.update({
      where: { id: bookId },
      data: {
        pendingRevisionData: JSON.parse(JSON.stringify({ input, bookFiles })),
      },
    });
    revalidatePath("/account/books");
    revalidatePath(`/account/books/${bookId}/edit`);
    return { ok: true };
  }

  const [category, genre] = await Promise.all([
    prisma.category.upsert({ where: { name: input.category }, update: {}, create: { name: input.category } }),
    prisma.genre.upsert({ where: { name: input.genre }, update: {}, create: { name: input.genre } }),
  ]);

  await prisma.$transaction([
    prisma.bookFile.deleteMany({ where: { bookId, kind: { in: ["MANUSCRIPT", "SAMPLE", "PROMOTIONAL"] } } }),
    prisma.categoryOnBook.deleteMany({ where: { bookId } }),
    prisma.genreOnBook.deleteMany({ where: { bookId } }),
    prisma.book.update({
      where: { id: bookId },
      data: {
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || null,
        description: input.description.trim(),
        isbn: input.isbn?.trim() || existing.isbn,
        price: input.price,
        status: "PENDING_REVIEW",
        ageGroup: input.ageGroup,
        language: input.language || "en",
        coverImageUrl: input.coverImageUrl?.trim() || null,
        coverAltText: input.coverAltText?.trim() || null,
        hasEbook: input.formats.ebook,
        hasPrint: input.formats.print,
        hasAudiobook: input.formats.audiobook,
        paperbackPrice: input.formats.print && input.metadata.paperbackEnabled && input.metadata.paperbackRetailPrice
          ? input.metadata.paperbackRetailPrice
          : null,
        hardcoverPrice: input.formats.print && input.metadata.hardcoverEnabled && input.metadata.hardcoverRetailPrice
          ? input.metadata.hardcoverRetailPrice
          : null,
        submissionMetadata: JSON.parse(JSON.stringify(input.metadata)),
        files: bookFiles.length > 0 ? { create: bookFiles } : undefined,
        categories: { create: [{ categoryId: category.id }] },
        genres: { create: [{ genreId: genre.id }] },
      },
    }),
  ]);

  revalidatePath("/account/books");
  revalidatePath(`/account/books/${bookId}/edit`);
  return { ok: true };
}

/**
 * Approves a pending revision to an already-published book — applies
 * the proposed changes (title, description, price, files, category,
 * genre, everything) to the real, live fields, and clears the pending
 * revision. This is the one moment the visible book actually changes.
 */
export async function approveBookRevision(bookId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return { ok: false, error: "Not authorized." };

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book?.pendingRevisionData) return { ok: false, error: "No pending revision on this book." };

  const { input, bookFiles } = book.pendingRevisionData as unknown as { input: SubmitBookInput; bookFiles: { kind: string; url: string }[] };

  const [category, genre] = await Promise.all([
    prisma.category.upsert({ where: { name: input.category }, update: {}, create: { name: input.category } }),
    prisma.genre.upsert({ where: { name: input.genre }, update: {}, create: { name: input.genre } }),
  ]);

  await prisma.$transaction([
    prisma.bookFile.deleteMany({ where: { bookId, kind: { in: ["MANUSCRIPT", "SAMPLE", "PROMOTIONAL"] } } }),
    prisma.categoryOnBook.deleteMany({ where: { bookId } }),
    prisma.genreOnBook.deleteMany({ where: { bookId } }),
    prisma.book.update({
      where: { id: bookId },
      data: {
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || null,
        description: input.description.trim(),
        isbn: input.isbn?.trim() || book.isbn,
        price: input.price,
        status: "PUBLISHED",
        ageGroup: input.ageGroup,
        language: input.language || "en",
        coverImageUrl: input.coverImageUrl?.trim() || null,
        coverAltText: input.coverAltText?.trim() || null,
        hasEbook: input.formats.ebook,
        hasPrint: input.formats.print,
        hasAudiobook: input.formats.audiobook,
        paperbackPrice: input.formats.print && input.metadata.paperbackEnabled && input.metadata.paperbackRetailPrice
          ? input.metadata.paperbackRetailPrice
          : null,
        hardcoverPrice: input.formats.print && input.metadata.hardcoverEnabled && input.metadata.hardcoverRetailPrice
          ? input.metadata.hardcoverRetailPrice
          : null,
        submissionMetadata: JSON.parse(JSON.stringify(input.metadata)),
        pendingRevisionData: null as unknown as object,
        files: bookFiles.length > 0 ? { create: bookFiles } : undefined,
        categories: { create: [{ categoryId: category.id }] },
        genres: { create: [{ genreId: genre.id }] },
      },
    }),
  ]);

  revalidatePath("/admin/books");
  revalidatePath(`/admin/books/${bookId}/review`);
  return { ok: true };
}

/** Rejects a pending revision — the live, published book is completely
 * unaffected; only the proposed changes are discarded. */
export async function rejectBookRevision(bookId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return { ok: false, error: "Not authorized." };

  await prisma.book.update({ where: { id: bookId }, data: { pendingRevisionData: null as unknown as object } });
  revalidatePath("/admin/books");
  revalidatePath(`/admin/books/${bookId}/review`);
  return { ok: true };
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
  coverAltText?: string;
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
        coverAltText: input.coverAltText?.trim() || null,
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

/** Withdraws a book from the catalog — removes it from the public
 * shelf entirely. A real status change (WITHDRAWN), not a hard delete:
 * the book's sales history and royalty records must stay intact for
 * accounting purposes even after it's pulled from sale, and a hard
 * delete would silently break those. */
export async function withdrawBook(bookId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return { ok: false, error: "Only author accounts can do this." };

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { authorProfile: true } });
  if (!user?.authorProfile) return { ok: false, error: "Author profile not found." };

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book || book.authorId !== user.authorProfile.id) return { ok: false, error: "Book not found." };

  await prisma.book.update({ where: { id: bookId }, data: { status: "WITHDRAWN" } });

  revalidatePath("/account/books");
  return { ok: true };
}
