import type { Prisma } from "@prisma/client";
import { isCategory, categoryOfSubcategory, normalizeGenre, isSubcategoryOf } from "@/lib/taxonomy";
import { parseRestrictedCountries } from "@/lib/book-country-restriction";
import type { EbookSubmissionInitial } from "../../new/EbookSubmissionForm";
import type { PrintSubmissionInitial } from "../../new/PrintSubmissionForm";
import type { SharedSubmissionFields } from "../../new/shared";

export type BookWithRelations = Prisma.BookGetPayload<{
  include: { categories: { include: { category: true } }; genres: { include: { genre: true } }; files: true };
}>;

type Meta = Record<string, unknown>;
const metaOf = (book: BookWithRelations): Meta => (book.submissionMetadata as Meta | null) ?? {};
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Classification prefill. New columns win; books from before the taxonomy
 * change fall back to the legacy joins (Category join = genre shelf, Genre
 * join = subcategory). Nothing is invented: anything that can't be mapped
 * stays empty so the author has to choose it. */
export function classify(book: BookWithRelations) {
  const legacyShelf = book.categories[0]?.category.name;
  const legacySub = book.genres[0]?.genre.name;
  const category = isCategory(book.category) ? book.category : categoryOfSubcategory(legacySub) ?? "";
  const subcategoryCandidate = book.subcategory ?? legacySub;
  const subcategory = category && isSubcategoryOf(category, subcategoryCandidate) ? (subcategoryCandidate as string) : "";
  const genre = normalizeGenre(legacyShelf) ?? "";
  return { category, subcategory, genre };
}

function fileIdOf(book: BookWithRelations, kind: string): string | undefined {
  return book.files.find((f: { kind: string; url: string }) => f.kind === kind)?.url.split("/").pop();
}

export function buildEbookInitial(book: BookWithRelations): EbookSubmissionInitial {
  const meta = metaOf(book);
  const { category, subcategory, genre } = classify(book);
  const restrictedCountries = book.restrictedCountries.length > 0 ? book.restrictedCountries : parseRestrictedCountries(meta.countryRestrictions as string | undefined);
  return {
    bookId: book.id,
    bookStatus: book.status,
    manuscriptFileId: fileIdOf(book, "MANUSCRIPT"),
    audiobookFileId: fileIdOf(book, "AUDIOBOOK"),
    audiobookPrice: book.audiobookPrice != null ? String(Number(book.audiobookPrice)) : "",
    coverImageUrl: book.coverImageUrl ?? "",
    title: book.title,
    subtitle: book.subtitle ?? "",
    edition: str(meta.edition),
    seriesName: str(meta.seriesName),
    seriesNumber: meta.seriesNumber != null ? String(meta.seriesNumber) : "",
    language: book.language ?? "English",
    publisher: str(meta.publisher),
    publicationDate: str(meta.publicationDate),
    originalPublicationDate: str(meta.originalPublicationDate),
    isbn: book.isbn ?? "",
    copyrightYear: meta.copyrightYear != null ? String(meta.copyrightYear) : String(new Date().getFullYear()),
    authorFirstName: str(meta.authorFirstName),
    authorLastName: str(meta.authorLastName),
    authorBio: str(meta.authorBio),
    category,
    genre,
    subcategory,
    ageGroup: book.ageGroup ?? "",
    readingLevel: str(meta.readingLevel),
    pages: meta.pages != null ? Number(meta.pages) : undefined,
    dimensions: str(meta.dimensions) || undefined,
    fileSizeKB: meta.fileSizeKB != null ? Number(meta.fileSizeKB) : undefined,
    descriptionHtml: str(meta.longDescriptionHtml) || book.description || "",
    aiDeclaration: str(meta.aiDeclaration),
    keywords: typeof meta.keywords === "string" ? (meta.keywords as string).split(",").map((k) => k.trim()).filter(Boolean) : [],
    // Book.price is the audiobook price for an audiobook-only title, so it
    // is not the eBook list price there; leave that field blank.
    price: book.ebookPrice != null
      ? String(Number(book.ebookPrice))
      : book.hasAudiobook && !book.hasEbook && !book.hasPrint
      ? ""
      : String(Number(book.price)),
    taxSetting: str(meta.taxSetting),
    affiliateEnabled: (meta.affiliateEnabled as boolean) ?? false,
    worldwideRights: restrictedCountries.length > 0 ? false : ((meta.worldwideRights as boolean) ?? true),
    restrictedCountries,
    copyrightHolder: str(meta.copyrightHolder),
    licenseType: str(meta.licenseType),
  };
}

export function buildPrintInitial(book: BookWithRelations): PrintSubmissionInitial {
  const meta = metaOf(book);
  const { category, subcategory, genre } = classify(book);
  const binding = str(meta.binding);
  const paperbackEnabled = typeof meta.paperbackEnabled === "boolean" ? meta.paperbackEnabled : book.paperbackPrice != null;
  const hardcoverEnabled = typeof meta.hardcoverEnabled === "boolean" ? meta.hardcoverEnabled : book.hardcoverPrice != null;
  const price = (v: unknown, fallback: unknown) => String(Number(v ?? fallback ?? 0) || 0);
  const bool = (k: string, d: boolean) => (typeof meta[k] === "boolean" ? (meta[k] as boolean) : d);
  return {
    bookId: book.id,
    bookStatus: book.status,
    title: book.title,
    subtitle: book.subtitle ?? "",
    seriesName: str(meta.seriesName),
    edition: str(meta.edition),
    isbn: book.isbn ?? "",
    language: book.language ?? "English",
    publisher: str(meta.publisher),
    publicationDate: str(meta.publicationDate),
    category,
    genre,
    subcategory,
    ageGroup: book.ageGroup ?? "",
    readingLevel: str(meta.readingLevel),
    description: book.description ?? "",
    aiDeclaration: str(meta.aiDeclaration),
    authorFirstName: str(meta.authorFirstName),
    authorLastName: str(meta.authorLastName),
    coAuthors: str(meta.coAuthors),
    illustrator: str(meta.illustrator),
    editor: str(meta.editor),
    translator: str(meta.translator),
    printReadyPdfFileId: fileIdOf(book, "MANUSCRIPT"),
    pages: meta.pages != null ? Number(meta.pages) : undefined,
    dimensions: str(meta.dimensions) || undefined,
    frontCoverImageUrl: str(meta.frontCoverImageUrl) || book.coverImageUrl || "",
    customBackCoverPdfFileId: str(meta.customBackCoverPdfFileId) || undefined,
    backCoverMode: meta.backCoverMode === "custom" ? "custom" : "auto",
    paperbackEnabled,
    hardcoverEnabled,
    trimCode: str(meta.trimSizeCode) || undefined,
    // "LW" is the hardcover binding; the paperback binding is only kept when it is one.
    paperbackBinding: binding && binding !== "LW" ? binding : undefined,
    interiorColor: str(meta.interiorColor) || undefined,
    printQuality: str(meta.printQuality) || undefined,
    paperType: str(meta.paperType) || undefined,
    coverFinish: str(meta.coverFinish) || undefined,
    linenColor: str(meta.linenColor) || undefined,
    foilColor: str(meta.foilColor) || undefined,
    foilStampTitleText: str(meta.foilStampTitleText),
    foilStampAuthorText: str(meta.foilStampAuthorText),
    paperbackRetailPrice: price(meta.paperbackRetailPrice, book.paperbackPrice),
    hardcoverRetailPrice: price(meta.hardcoverRetailPrice, book.hardcoverPrice),
    luluGlobalDistribution: bool("luluGlobalDistribution", true),
    privatePrinting: bool("privatePrinting", false),
    affiliateEligiblePrint: bool("affiliateEligiblePrint", false),
    promotionalCampaignEligible: bool("promotionalCampaignEligible", false),
  };
}

/** The details both editions share, used to pre-fill an edition being added. */
export function sharedPrefill(book: BookWithRelations, c: { category: string; genre: string; subcategory: string }, meta: Meta): SharedSubmissionFields {
  return {
    title: book.title,
    subtitle: book.subtitle ?? "",
    edition: str(meta.edition),
    seriesName: str(meta.seriesName),
    language: book.language ?? "English",
    publicationDate: str(meta.publicationDate),
    category: c.category,
    genre: c.genre,
    subcategory: c.subcategory,
    ageGroup: book.ageGroup ?? "",
    readingLevel: str(meta.readingLevel),
    authorFirstName: str(meta.authorFirstName),
    authorLastName: str(meta.authorLastName),
    description: (book.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    aiDeclaration: str(meta.aiDeclaration),
    publisher: str(meta.publisher),
    coverImageUrl: book.coverImageUrl ?? "",
  };
}
