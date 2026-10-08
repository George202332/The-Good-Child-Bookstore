"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canModerateContent } from "@/lib/roles";
import { isCategory, isGenre, isSubcategoryOf } from "@/lib/taxonomy";
import { parseRestrictedCountries } from "@/lib/book-country-restriction";
import { needsReReview, fileRefKey } from "@/lib/revision-trigger";
import { resolveFormats } from "@/lib/submission-formats";

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

// Server-side backstop for the submission form's 200-word description
// cap (see EbookSubmissionForm.tsx) — the form already blocks submission
// over this limit, but a direct action call (or a future second form)
// shouldn't be able to bypass it and land a description long enough to
// overflow the product page again.
const DESCRIPTION_WORD_LIMIT = 200;
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
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
  /** Page count — auto-detected from the uploaded manuscript when it's
   * a PDF (or converts to one), editable in case detection can't run
   * (EPUB/MOBI) or comes out wrong. Drives the product page's detail
   * card "Pages" figure (see lib/data/real-books-adapter.ts). */
  pages?: number;
  /** Trim size, e.g. "5.5 x 8.5 in" — shown on the product page's detail
   * card. */
  dimensions?: string;
  /** The manuscript file's size in KB, auto-detected at upload time (see
   * actions/files.ts) and shown on the product page's detail card as
   * "File Size" — replaces an earlier "Weight (lb)" field, which never
   * reflected anything real for a digital book. */
  fileSizeKB?: number;
  /** The author's own statement of how (or whether) they used AI in
   * creating this book — shown on the product page's detail card in
   * place of the old "handpicked by our shelf team" line, since the
   * platform doesn't actually hand-pick or curate titles. Free text,
   * written by the author at submission; not validated or fact-checked. */
  aiDeclaration?: string;
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
  /** Whether an audiobook file has actually been uploaded on the eBook /
   * Audiobook tab — audiobookRetailPrice (and the Audiobook format
   * itself) is only ever meaningful when this is true; the price field
   * doesn't even render on the form until an audio file is uploaded. */
  audiobookEnabled?: boolean;
  /** The audiobook's own retail price — a separate purchasable edition
   * from the eBook, same pattern as paperbackRetailPrice/
   * hardcoverRetailPrice below. */
  audiobookRetailPrice?: number;
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
  /** Book "Category" — one of the eight series in lib/taxonomy.ts
   * (stored in Book.category). */
  category: string;
  /** Book "Genre" — one of the five shelves in lib/taxonomy.ts. Stored
   * on the legacy Category join (CategoryOnBook, by name) that the shelf
   * logic reads. */
  genre: string;
  /** Book "Subcategory" — must belong to `category` (Book.subcategory;
   * also written to the legacy Genre join, GenreOnBook, by name). */
  subcategory: string;
  /** Countries where this book may NOT be sold, ISO-2 (Book.restrictedCountries).
   * Ignored (stored as []) when metadata.worldwideRights is true. */
  restrictedCountries?: string[];
  language: string;
  coverImageUrl?: string;
  coverAltText?: string;
  manuscriptFileId?: string;
  samplePagesFileId?: string;
  /** The uploaded audiobook file — optional, lives on the eBook /
   * Audiobook tab. Stored as its own BookFile (kind "AUDIOBOOK"), same
   * pattern as the manuscript. */
  audiobookFileId?: string;
  promotionalImageUrls?: string[];
  formats: { ebook: boolean; print: boolean; audiobook: boolean };
  metadata: SubmissionMetadata;
  submitForReview: boolean;
}

/** Validated, normalised view of a submission — shared by submitBook,
 * updateBookFull and approveBookRevision so the three never drift. */
interface PreparedSubmission {
  category: string;
  genre: string;
  subcategory: string;
  /** False only for a pre-taxonomy pending revision approved after the
   * taxonomy change — those carry legacy names and are written to the
   * legacy joins only, never into Book.category/subcategory. */
  taxonomyColumns: boolean;
  restrictedCountries: string[];
  metadata: SubmissionMetadata;
  hasEbook: boolean;
  /** Null when there is no eBook (no manuscript) — never stored then. */
  ebookPrice: number | null;
  hasAudiobook: boolean;
  audiobookPrice: number | null;
  /** Value for the required Book.price column: the eBook price when an
   * eBook exists, otherwise the audiobook price. */
  basePrice: number;
}

function prepareSubmission(input: SubmitBookInput, opts: { lenient?: boolean } = {}): { ok: true; value: PreparedSubmission } | { ok: false; error: string } {
  let taxonomyColumns = true;
  if (!isCategory(input.category) || !isGenre(input.genre) || !input.subcategory) {
    const legacy = opts.lenient && !input.subcategory && !!input.category && !!input.genre;
    if (!legacy) {
      if (!isCategory(input.category)) return { ok: false, error: "Please choose a Category." };
      if (!isGenre(input.genre)) return { ok: false, error: "Please choose a Genre." };
      return { ok: false, error: "Please choose a Subcategory." };
    }
    taxonomyColumns = false;
  } else if (!isSubcategoryOf(input.category, input.subcategory)) {
    return { ok: false, error: "That Subcategory doesn't belong to the selected Category — please choose it again." };
  }

  const meta = input.metadata;
  const worldwide = meta.worldwideRights !== false;
  const restrictedCountries = worldwide ? [] : parseRestrictedCountries(input.restrictedCountries ?? meta.countryRestrictions);
  if (!worldwide && restrictedCountries.length === 0 && !opts.lenient) {
    return { ok: false, error: "Choose at least one country where this book may not be sold, or turn on worldwide distribution rights." };
  }

  // eBook (manuscript) and audiobook are independent: either, or both, but
  // at least one. The eBook price is required only with a manuscript and the
  // audiobook price only with an audiobook file (see lib/submission-formats.ts).
  // Print titles (formats.print) carry their own files and price and are
  // not subject to the eBook/audiobook rule.
  const isPrintTitle = input.formats.print;
  const fmt = resolveFormats({
    // A pre-existing (lenient) revision that was saved as an eBook keeps its
    // eBook even if its manuscript reference is no longer in the payload.
    manuscriptFileId: isPrintTitle ? undefined : input.manuscriptFileId || (opts.lenient && input.formats.ebook ? "legacy" : undefined),
    audiobookFileId: input.audiobookFileId,
    ebookPrice: input.price,
    audiobookPrice: meta.audiobookRetailPrice,
    requireFile: !isPrintTitle,
  });
  if (fmt.errors.length > 0) return { ok: false, error: fmt.errors[0] };
  if (isPrintTitle && !(input.price > 0)) return { ok: false, error: "Price must be greater than $0." };
  const hasEbook = isPrintTitle ? input.formats.ebook : fmt.hasEbook;
  const ebookPrice = isPrintTitle ? null : fmt.ebookPrice;
  const hasAudiobook = fmt.hasAudiobook;
  const audiobookPrice = fmt.audiobookPrice;
  const basePrice = isPrintTitle ? input.price : (fmt.basePrice as number);

  const metadata: SubmissionMetadata = {
    ...meta,
    // Pages / dimensions / file size describe the manuscript; an
    // audiobook-only title has none.
    ...(!isPrintTitle && !hasEbook ? { pages: undefined, dimensions: undefined, fileSizeKB: undefined } : {}),
    worldwideRights: worldwide,
    countryRestrictions: restrictedCountries.length > 0 ? restrictedCountries.join(", ") : undefined,
    // All books are sold on the store; featured placement is not yet available.
    sellOnStore: true,
    featuredRequest: false,
    audiobookEnabled: hasAudiobook,
    audiobookRetailPrice: audiobookPrice ?? undefined,
  };

  // Legacy payloads: input.category was the shelf name and input.genre the
  // legacy genre, so map them straight onto the two legacy joins.
  const names = taxonomyColumns
    ? { category: input.category, genre: input.genre, subcategory: input.subcategory }
    : { category: "", genre: input.category, subcategory: input.genre };
  return { ok: true, value: { ...names, taxonomyColumns, restrictedCountries, metadata, hasEbook, ebookPrice, hasAudiobook, audiobookPrice, basePrice } };
}

export async function submitBook(input: SubmitBookInput): Promise<{ ok: boolean; error?: string; bookId?: string }> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") {
    return { ok: false, error: "Only author accounts can submit books." };
  }
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (!input.description.trim()) return { ok: false, error: "Short description is required." };
  if (countWords(input.description) > DESCRIPTION_WORD_LIMIT) {
    return { ok: false, error: `The description is over the ${DESCRIPTION_WORD_LIMIT}-word limit — please shorten it.` };
  }

  const prepared = prepareSubmission(input);
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const prep = prepared.value;

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
  if (input.audiobookFileId) bookFiles.push({ kind: "AUDIOBOOK", url: `/api/files/${input.audiobookFileId}` });
  for (const url of input.promotionalImageUrls ?? []) bookFiles.push({ kind: "PROMOTIONAL", url });

  // Legacy joins: the Category relation holds the GENRE shelf name, the
  // Genre relation holds the subcategory name (what the storefront reads).
  const [category, genre, siteMode] = await Promise.all([
    prisma.category.upsert({ where: { name: prep.genre }, update: {}, create: { name: prep.genre } }),
    prisma.genre.upsert({ where: { name: prep.subcategory }, update: {}, create: { name: prep.subcategory } }),
    import("@/actions/test-data").then((m) => m.getSiteDataMode()),
  ]);

  const book = await prisma.book.create({
    data: {
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      slug,
      description: input.description.trim(),
      isbn: input.isbn?.trim() || (input.formats.print ? generateIsbn() : prep.hasEbook || prep.hasAudiobook ? generateSerialNumber() : null),
      price: prep.basePrice,
      isTestData: siteMode === "test",
      status: input.submitForReview ? "PENDING_REVIEW" : "DRAFT",
      authorId: user.authorProfile.id,
      ageGroup: input.ageGroup,
      language: input.language || "en",
      coverImageUrl: input.coverImageUrl?.trim() || null,
      coverAltText: input.coverAltText?.trim() || null,
      hasEbook: prep.hasEbook,
      hasPrint: input.formats.print,
      hasAudiobook: prep.hasAudiobook,
      ebookPrice: prep.ebookPrice,
      paperbackPrice: input.formats.print && input.metadata.paperbackEnabled && input.metadata.paperbackRetailPrice
        ? input.metadata.paperbackRetailPrice
        : null,
      hardcoverPrice: input.formats.print && input.metadata.hardcoverEnabled && input.metadata.hardcoverRetailPrice
        ? input.metadata.hardcoverRetailPrice
        : null,
      // Audiobook is only ever a purchasable, visible format once BOTH
      // an audio file has actually been uploaded AND a price has been
      // set (prepareSubmission rejects a file without a price) — this is
      // the real per-format price the storefront and checkout read.
      audiobookPrice: prep.audiobookPrice,
      category: prep.category,
      subcategory: prep.subcategory,
      restrictedCountries: prep.restrictedCountries,
      submissionMetadata: JSON.parse(JSON.stringify(prep.metadata)),
      files: bookFiles.length > 0 ? { create: bookFiles } : undefined,
      categories: { create: [{ categoryId: category.id }] },
      genres: { create: [{ genreId: genre.id }] },
    },
  });

  revalidatePath("/account/books");
  return { ok: true, bookId: book.id };
}

/** What a "pending revision" can hold. "files" is the current format: only
 * the replaced manuscript and/or cover wait for approval (every other edit
 * has already been applied live). The older whole-revision format
 * ({ input, bookFiles }) is still understood so revisions saved before
 * this rule existed can be approved or carried over. */
interface PendingFilesRevision {
  kind: "files";
  manuscriptFileId?: string;
  coverImageUrl?: string;
  /** Manuscript-derived details that belong with the held manuscript
   * (page count, trim size, file size) — applied only on approval. */
  metadataPatch?: Partial<Pick<SubmissionMetadata, "pages" | "dimensions" | "fileSizeKB">>;
  /** The held manuscript is the title's first (an audiobook-only title
   * gaining an eBook): on approval the eBook edition goes on sale at
   * `ebookPrice`. */
  introducesEbook?: boolean;
  ebookPrice?: number;
}

function readPendingFiles(raw: unknown): PendingFilesRevision | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { kind?: string; input?: Partial<SubmitBookInput>; manuscriptFileId?: string; coverImageUrl?: string; metadataPatch?: PendingFilesRevision["metadataPatch"]; introducesEbook?: boolean; ebookPrice?: number };
  if (r.kind === "files") {
    return { kind: "files", manuscriptFileId: r.manuscriptFileId, coverImageUrl: r.coverImageUrl, metadataPatch: r.metadataPatch, introducesEbook: r.introducesEbook, ebookPrice: r.ebookPrice };
  }
  if (r.input) {
    const m = r.input.metadata;
    return {
      kind: "files",
      manuscriptFileId: r.input.manuscriptFileId,
      coverImageUrl: r.input.coverImageUrl,
      metadataPatch: m ? { pages: m.pages, dimensions: m.dimensions, fileSizeKB: m.fileSizeKB } : undefined,
    };
  }
  return null;
}

/** Print-only metadata the eBook-style edit form never sends; kept from the
 * stored book when a live print title is edited so a save can't wipe it. */
const PRINT_METADATA_KEYS = [
  "interiorColor", "printQuality", "binding", "paperType", "coverFinish", "linenColor", "foilColor",
  "trimSizeCode", "podPackageId", "paperbackEnabled", "hardcoverEnabled", "paperbackRetailPrice",
  "hardcoverRetailPrice", "foilStampTitleText", "foilStampAuthorText", "printReadyPdfFileId",
  "frontCoverImageUrl", "customBackCoverPdfFileId", "backCoverMode", "sellThroughWebsite",
  "luluGlobalDistribution", "privatePrinting", "affiliateEligiblePrint", "promotionalCampaignEligible",
] as const;

export interface UpdateBookFullResult {
  ok: boolean;
  error?: string;
  /** "live": a published book's edits are live now. "live_files_pending":
   * edits are live, a replaced manuscript/cover awaits review.
   * "resubmitted": a non-published book went (back) to review. */
  outcome?: "live" | "live_files_pending" | "resubmitted";
  /** Which replaced file(s) are on hold, when outcome is "live_files_pending". */
  held?: "manuscript" | "cover" | "both";
  message?: string;
}

/**
 * Edits an existing book using the exact same full field set as
 * submitBook — manuscript, author name/alias, ISBN/SN, keywords, SEO
 * metadata, pricing, distribution, everything — per explicit
 * instruction that editing should be "the same exact page" as
 * submitting.
 *
 * Draft / pending / rejected books have no live version to protect and
 * are resubmitted for review on save, as before. A PUBLISHED book stays
 * live: every edit applies immediately EXCEPT a replaced manuscript or
 * cover, which is held as a pending revision (the live file keeps
 * serving) until an admin approves it. Whether a file was replaced is
 * decided here, on the server, from the stored file references.
 */
export async function updateBookFull(bookId: string, input: SubmitBookInput): Promise<UpdateBookFullResult> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return { ok: false, error: "Only author accounts can edit books." };
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (!input.description.trim()) return { ok: false, error: "Description is required." };
  if (countWords(input.description) > DESCRIPTION_WORD_LIMIT) {
    return { ok: false, error: `The description is over the ${DESCRIPTION_WORD_LIMIT}-word limit — please shorten it.` };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { authorProfile: true } });
  if (!user?.authorProfile) return { ok: false, error: "Author profile not found." };

  const existing = await prisma.book.findUnique({ where: { id: bookId } });
  if (!existing || existing.authorId !== user.authorProfile.id) return { ok: false, error: "Book not found." };

  // A published title keeps its live files when the save sends none, so the
  // eBook / audiobook decision is made against the manuscript that will be
  // live (or the new one). An audiobook-only title simply has none.
  const liveManuscriptRef = existing.status === "PUBLISHED"
    ? (await prisma.bookFile.findFirst({ where: { bookId, kind: "MANUSCRIPT" } }))?.url
    : undefined;
  const prepared = prepareSubmission({ ...input, manuscriptFileId: input.manuscriptFileId || fileRefKey(liveManuscriptRef) || undefined });
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const prep = prepared.value;

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
  if (input.audiobookFileId) bookFiles.push({ kind: "AUDIOBOOK", url: `/api/files/${input.audiobookFileId}` });
  for (const url of input.promotionalImageUrls ?? []) bookFiles.push({ kind: "PROMOTIONAL", url });

  if (existing.status === "PUBLISHED") {
    const liveFiles = await prisma.bookFile.findMany({ where: { bookId } });
    const liveManuscript = liveFiles.find((f) => f.kind === "MANUSCRIPT");
    const liveAudio = liveFiles.find((f) => f.kind === "AUDIOBOOK");
    const liveSample = liveFiles.find((f) => f.kind === "SAMPLE");

    // Server-side decision: only a manuscript/cover that differs from what
    // is stored triggers review. Re-sending the same file, or sending none,
    // keeps the live file as it is.
    const decision = needsReReview({
      currentManuscriptRef: liveManuscript?.url,
      newManuscriptRef: input.manuscriptFileId,
      currentCoverRef: existing.coverImageUrl,
      newCoverRef: input.coverImageUrl,
    });

    const existingMeta = (existing.submissionMetadata as Partial<SubmissionMetadata> | null) ?? {};
    const keepPrint = existing.hasPrint && !input.formats.print;
    let metadata: SubmissionMetadata = prep.metadata;
    if (keepPrint) {
      const carried: Record<string, unknown> = {};
      for (const k of PRINT_METADATA_KEYS) if (existingMeta[k] !== undefined) carried[k] = existingMeta[k];
      metadata = { ...metadata, ...carried };
    }
    if (decision.manuscript) {
      // These describe the manuscript; they change when it is approved.
      metadata = { ...metadata, pages: existingMeta.pages, dimensions: existingMeta.dimensions, fileSizeKB: existingMeta.fileSizeKB };
    }

    // The revision that stays on hold: this save's replaced files, plus any
    // earlier held file this save did not touch (and that still differs
    // from the live one). Anything else from an older revision is dropped,
    // exactly as a new save used to overwrite it.
    const prior = readPendingFiles(existing.pendingRevisionData);
    const priorManuscript = prior?.manuscriptFileId && fileRefKey(prior.manuscriptFileId) !== fileRefKey(liveManuscript?.url) ? prior.manuscriptFileId : undefined;
    const priorCover = prior?.coverImageUrl && fileRefKey(prior.coverImageUrl) !== fileRefKey(existing.coverImageUrl) ? prior.coverImageUrl : undefined;
    const heldManuscript = decision.manuscript ? input.manuscriptFileId : priorManuscript;
    const heldCover = decision.cover ? input.coverImageUrl?.trim() : priorCover;
    // The title has no live manuscript (audiobook-only, or print-only), so a
    // held manuscript would introduce its eBook: that edition only goes on
    // sale — with its price — once the manuscript is approved.
    const introducesEbook = !!heldManuscript && !liveManuscript && !existing.hasPrint;
    const heldEbookPrice = introducesEbook ? (prep.ebookPrice ?? (prior?.ebookPrice ?? null)) : null;
    const liveHasEbook = keepPrint && !existing.hasEbook ? false : introducesEbook ? existing.hasEbook : prep.hasEbook;
    const liveBasePrice = liveHasEbook ? (prep.ebookPrice ?? prep.basePrice) : (prep.audiobookPrice ?? (keepPrint ? input.price : prep.basePrice));
    const held: PendingFilesRevision | null = heldManuscript || heldCover
      ? {
          kind: "files",
          ...(heldManuscript ? { manuscriptFileId: heldManuscript } : {}),
          ...(introducesEbook && heldEbookPrice !== null ? { introducesEbook: true, ebookPrice: heldEbookPrice } : {}),
          ...(heldCover ? { coverImageUrl: heldCover } : {}),
          ...(heldManuscript
            ? { metadataPatch: decision.manuscript ? { pages: prep.metadata.pages, dimensions: prep.metadata.dimensions, fileSizeKB: prep.metadata.fileSizeKB } : prior?.metadataPatch }
            : {}),
        }
      : null;

    // Audiobook, sample and promotional files never trigger review; they
    // are only rewritten when the incoming reference actually differs.
    const kindsToReplace: string[] = [];
    const filesToCreate: { kind: string; url: string }[] = [];
    if (fileRefKey(input.audiobookFileId) !== fileRefKey(liveAudio?.url)) {
      kindsToReplace.push("AUDIOBOOK");
      if (input.audiobookFileId) filesToCreate.push({ kind: "AUDIOBOOK", url: `/api/files/${input.audiobookFileId}` });
    }
    if (input.samplePagesFileId && fileRefKey(input.samplePagesFileId) !== fileRefKey(liveSample?.url)) {
      kindsToReplace.push("SAMPLE");
      filesToCreate.push({ kind: "SAMPLE", url: `/api/files/${input.samplePagesFileId}` });
    }
    if (input.promotionalImageUrls && input.promotionalImageUrls.length > 0) {
      kindsToReplace.push("PROMOTIONAL");
      for (const url of input.promotionalImageUrls) filesToCreate.push({ kind: "PROMOTIONAL", url });
    }

    const [liveCategory, liveGenre] = await Promise.all([
      prisma.category.upsert({ where: { name: prep.genre }, update: {}, create: { name: prep.genre } }),
      prisma.genre.upsert({ where: { name: prep.subcategory }, update: {}, create: { name: prep.subcategory } }),
    ]);

    await prisma.$transaction([
      ...(kindsToReplace.length > 0 ? [prisma.bookFile.deleteMany({ where: { bookId, kind: { in: kindsToReplace } } })] : []),
      prisma.categoryOnBook.deleteMany({ where: { bookId } }),
      prisma.genreOnBook.deleteMany({ where: { bookId } }),
      prisma.book.update({
        where: { id: bookId },
        data: {
          title: input.title.trim(),
          subtitle: input.subtitle?.trim() || null,
          description: input.description.trim(),
          isbn: input.isbn?.trim() || existing.isbn,
          price: liveBasePrice,
          // status stays PUBLISHED; coverImageUrl and the MANUSCRIPT file
          // are deliberately not written here (live until a held
          // replacement is approved).
          ageGroup: input.ageGroup,
          language: input.language || "en",
          coverAltText: input.coverAltText?.trim() || null,
          hasEbook: liveHasEbook,
          ...(introducesEbook ? {} : { ebookPrice: liveHasEbook ? prep.ebookPrice : null }),
          hasPrint: keepPrint ? true : input.formats.print,
          hasAudiobook: prep.hasAudiobook,
          paperbackPrice: keepPrint
            ? existing.paperbackPrice
            : input.formats.print && input.metadata.paperbackEnabled && input.metadata.paperbackRetailPrice
            ? input.metadata.paperbackRetailPrice
            : null,
          hardcoverPrice: keepPrint
            ? existing.hardcoverPrice
            : input.formats.print && input.metadata.hardcoverEnabled && input.metadata.hardcoverRetailPrice
            ? input.metadata.hardcoverRetailPrice
            : null,
          audiobookPrice: prep.audiobookPrice,
          category: prep.category,
          subcategory: prep.subcategory,
          restrictedCountries: prep.restrictedCountries,
          submissionMetadata: JSON.parse(JSON.stringify(metadata)),
          ...(held
            ? { pendingRevisionData: JSON.parse(JSON.stringify(held)) }
            : existing.pendingRevisionData != null
            ? { pendingRevisionData: null as unknown as object }
            : {}),
          files: filesToCreate.length > 0 ? { create: filesToCreate } : undefined,
          categories: { create: [{ categoryId: liveCategory.id }] },
          genres: { create: [{ genreId: liveGenre.id }] },
        },
      }),
    ]);

    revalidatePath("/account/books");
    revalidatePath(`/account/books/${bookId}/edit`);
    revalidatePath(`/admin/books/${bookId}/review`);
    revalidatePath("/admin/books");
    if (!decision.required) {
      return { ok: true, outcome: "live", message: "Your changes were saved and are live now." };
    }
    const what = decision.manuscript && decision.cover ? "new manuscript and cover are" : decision.manuscript ? "new manuscript is" : "new cover is";
    return {
      ok: true,
      outcome: "live_files_pending",
      held: decision.manuscript && decision.cover ? "both" : decision.manuscript ? "manuscript" : "cover",
      message: `Your changes were saved. Your ${what} under review and will go live once approved.`,
    };
  }

  const [category, genre] = await Promise.all([
    prisma.category.upsert({ where: { name: prep.genre }, update: {}, create: { name: prep.genre } }),
    prisma.genre.upsert({ where: { name: prep.subcategory }, update: {}, create: { name: prep.subcategory } }),
  ]);

  await prisma.$transaction([
    prisma.bookFile.deleteMany({ where: { bookId, kind: { in: ["MANUSCRIPT", "SAMPLE", "PROMOTIONAL", "AUDIOBOOK"] } } }),
    prisma.categoryOnBook.deleteMany({ where: { bookId } }),
    prisma.genreOnBook.deleteMany({ where: { bookId } }),
    prisma.book.update({
      where: { id: bookId },
      data: {
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || null,
        description: input.description.trim(),
        isbn: input.isbn?.trim() || existing.isbn,
        price: prep.basePrice,
        status: "PENDING_REVIEW",
        ageGroup: input.ageGroup,
        language: input.language || "en",
        coverImageUrl: input.coverImageUrl?.trim() || null,
        coverAltText: input.coverAltText?.trim() || null,
        hasEbook: prep.hasEbook,
        hasPrint: input.formats.print,
        hasAudiobook: prep.hasAudiobook,
        ebookPrice: prep.ebookPrice,
        paperbackPrice: input.formats.print && input.metadata.paperbackEnabled && input.metadata.paperbackRetailPrice
          ? input.metadata.paperbackRetailPrice
          : null,
        hardcoverPrice: input.formats.print && input.metadata.hardcoverEnabled && input.metadata.hardcoverRetailPrice
          ? input.metadata.hardcoverRetailPrice
          : null,
        audiobookPrice: prep.audiobookPrice,
        category: prep.category,
        subcategory: prep.subcategory,
        restrictedCountries: prep.restrictedCountries,
        submissionMetadata: JSON.parse(JSON.stringify(prep.metadata)),
        files: bookFiles.length > 0 ? { create: bookFiles } : undefined,
        categories: { create: [{ categoryId: category.id }] },
        genres: { create: [{ genreId: genre.id }] },
      },
    }),
  ]);

  revalidatePath("/account/books");
  revalidatePath(`/account/books/${bookId}/edit`);
  return { ok: true, outcome: "resubmitted", message: "Your changes were saved and the book was sent for review." };
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

  const rawPending = book.pendingRevisionData as unknown as { kind?: string };
  if (rawPending.kind === "files") {
    // Files-only revision: every other edit is already live, so apply just
    // the held manuscript/cover (and the manuscript's own page count etc.).
    const held = readPendingFiles(rawPending);
    const liveMeta = (book.submissionMetadata as Record<string, unknown> | null) ?? {};
    const patch = JSON.parse(JSON.stringify(held?.metadataPatch ?? {})) as Record<string, unknown>;
    await prisma.$transaction([
      ...(held?.manuscriptFileId ? [prisma.bookFile.deleteMany({ where: { bookId, kind: "MANUSCRIPT" } })] : []),
      prisma.book.update({
        where: { id: bookId },
        data: {
          ...(held?.manuscriptFileId && held.introducesEbook && held.ebookPrice
            ? { hasEbook: true, ebookPrice: held.ebookPrice, price: held.ebookPrice }
            : {}),
          ...(held?.coverImageUrl ? { coverImageUrl: held.coverImageUrl } : {}),
          ...(held?.manuscriptFileId ? { submissionMetadata: JSON.parse(JSON.stringify({ ...liveMeta, ...patch })), files: { create: [{ kind: "MANUSCRIPT", url: `/api/files/${held.manuscriptFileId}` }] } } : {}),
          pendingRevisionData: null as unknown as object,
        },
      }),
    ]);
    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${bookId}/review`);
    revalidatePath("/account/books");
    return { ok: true };
  }

  const { input, bookFiles } = book.pendingRevisionData as unknown as { input: SubmitBookInput; bookFiles: { kind: string; url: string }[] };

  // Revisions saved before the taxonomy change carry legacy names and are
  // approved leniently (legacy joins only, Book.category/subcategory untouched).
  const prepared = prepareSubmission(input, { lenient: true });
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const prep = prepared.value;

  const [category, genre] = await Promise.all([
    prisma.category.upsert({ where: { name: prep.genre }, update: {}, create: { name: prep.genre } }),
    prisma.genre.upsert({ where: { name: prep.subcategory }, update: {}, create: { name: prep.subcategory } }),
  ]);

  await prisma.$transaction([
    prisma.bookFile.deleteMany({ where: { bookId, kind: { in: ["MANUSCRIPT", "SAMPLE", "PROMOTIONAL", "AUDIOBOOK"] } } }),
    prisma.categoryOnBook.deleteMany({ where: { bookId } }),
    prisma.genreOnBook.deleteMany({ where: { bookId } }),
    prisma.book.update({
      where: { id: bookId },
      data: {
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || null,
        description: input.description.trim(),
        isbn: input.isbn?.trim() || book.isbn,
        price: prep.basePrice,
        status: "PUBLISHED",
        ageGroup: input.ageGroup,
        language: input.language || "en",
        coverImageUrl: input.coverImageUrl?.trim() || null,
        coverAltText: input.coverAltText?.trim() || null,
        hasEbook: prep.hasEbook,
        hasPrint: input.formats.print,
        hasAudiobook: prep.hasAudiobook,
        ebookPrice: prep.ebookPrice,
        paperbackPrice: input.formats.print && input.metadata.paperbackEnabled && input.metadata.paperbackRetailPrice
          ? input.metadata.paperbackRetailPrice
          : null,
        hardcoverPrice: input.formats.print && input.metadata.hardcoverEnabled && input.metadata.hardcoverRetailPrice
          ? input.metadata.hardcoverRetailPrice
          : null,
        audiobookPrice: prep.audiobookPrice,
        ...(prep.taxonomyColumns ? { category: prep.category, subcategory: prep.subcategory } : {}),
        restrictedCountries: prep.restrictedCountries,
        submissionMetadata: JSON.parse(JSON.stringify(prep.metadata)),
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
  if (countWords(input.description) > DESCRIPTION_WORD_LIMIT) {
    return { ok: false, error: `The description is over the ${DESCRIPTION_WORD_LIMIT}-word limit — please shorten it.` };
  }
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
