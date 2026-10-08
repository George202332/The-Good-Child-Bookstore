import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { EbookSubmissionForm } from "../../new/EbookSubmissionForm";
import { isCategory, categoryOfSubcategory, normalizeGenre, isSubcategoryOf } from "@/lib/taxonomy";
import { parseRestrictedCountries } from "@/lib/book-country-restriction";

/**
 * Edit an existing book — genuinely the same page used to submit a new
 * title (see app/account/books/new/EbookSubmissionForm.tsx), in edit
 * mode: every field pre-filled from the existing book, not a
 * separate, simplified form. Saving resubmits an unpublished book for
 * review; a published book saves live and only a replaced manuscript or
 * cover goes to review.
 */
export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { authorProfile: true } });
  if (!user?.authorProfile) redirect("/account/books");

  const book = await prisma.book.findUnique({
    where: { id },
    include: { categories: { include: { category: true } }, genres: { include: { genre: true } }, files: true },
  });
  if (!book || book.authorId !== user.authorProfile.id) notFound();

  const manuscriptFile = book.files.find((f: { kind: string; url: string }) => f.kind === "MANUSCRIPT");
  const manuscriptFileId = manuscriptFile?.url.split("/").pop();
  const audiobookFile = book.files.find((f: { kind: string; url: string }) => f.kind === "AUDIOBOOK");
  const audiobookFileId = audiobookFile?.url.split("/").pop();
  const meta = (book.submissionMetadata as Record<string, unknown> | null) ?? {};

  // Classification prefill. New columns win; books from before the taxonomy
  // change fall back to the legacy joins (Category join = genre shelf, Genre
  // join = subcategory). Nothing is invented: anything that can't be mapped
  // stays empty so the author has to choose it.
  const legacyShelf = book.categories[0]?.category.name;
  const legacySub = book.genres[0]?.genre.name;
  const categoryValue = isCategory(book.category) ? book.category : categoryOfSubcategory(legacySub) ?? "";
  const subcategoryCandidate = book.subcategory ?? legacySub;
  const subcategoryValue = categoryValue && isSubcategoryOf(categoryValue, subcategoryCandidate) ? (subcategoryCandidate as string) : "";
  const genreValue = normalizeGenre(legacyShelf) ?? "";
  const restrictedCountries = book.restrictedCountries.length > 0 ? book.restrictedCountries : parseRestrictedCountries(meta.countryRestrictions as string | undefined);

  return (
    <DashboardShell role="AUTHOR" activeKey="mybooks" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Edit: {book.title}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            {book.status === "PUBLISHED"
              ? "Changes to details such as price, description and categories go live as soon as you save. Replacing the manuscript or the cover sends the new file for review; your current file stays live until it is approved."
              : "Saving these changes resubmits the book for review."}
          </p>
        </div>
      </div>
      <EbookSubmissionForm
        initial={{
          bookId: book.id,
          bookStatus: book.status,
          manuscriptFileId,
          audiobookFileId,
          audiobookPrice: book.audiobookPrice != null ? String(Number(book.audiobookPrice)) : "",
          coverImageUrl: book.coverImageUrl ?? "",
          title: book.title,
          subtitle: book.subtitle ?? "",
          edition: (meta.edition as string) ?? "",
          seriesName: (meta.seriesName as string) ?? "",
          seriesNumber: meta.seriesNumber != null ? String(meta.seriesNumber) : "",
          language: book.language ?? "English",
          publisher: (meta.publisher as string) ?? "The Good Child Bookstore",
          publicationDate: (meta.publicationDate as string) ?? "",
          originalPublicationDate: (meta.originalPublicationDate as string) ?? "",
          isbn: book.isbn ?? "",
          copyrightYear: meta.copyrightYear != null ? String(meta.copyrightYear) : String(new Date().getFullYear()),
          authorFirstName: (meta.authorFirstName as string) ?? "",
          authorLastName: (meta.authorLastName as string) ?? "",
          authorBio: (meta.authorBio as string) ?? "",
          category: categoryValue,
          genre: genreValue,
          subcategory: subcategoryValue,
          ageGroup: book.ageGroup ?? "",
          readingLevel: (meta.readingLevel as string) ?? "",
          pages: meta.pages != null ? Number(meta.pages) : undefined,
          dimensions: (meta.dimensions as string) ?? undefined,
          fileSizeKB: meta.fileSizeKB != null ? Number(meta.fileSizeKB) : undefined,
          descriptionHtml: (meta.longDescriptionHtml as string) ?? book.description ?? "",
          aiDeclaration: (meta.aiDeclaration as string) ?? "",
          keywords: typeof meta.keywords === "string" ? (meta.keywords as string).split(",").map((k) => k.trim()).filter(Boolean) : [],
          // Book.price is the audiobook price for an audiobook-only title, so
          // it is not the eBook list price there; leave that field blank.
          price: book.ebookPrice != null
            ? String(Number(book.ebookPrice))
            : book.hasAudiobook && !book.hasEbook && !book.hasPrint
            ? ""
            : String(Number(book.price)),
          taxSetting: (meta.taxSetting as string) ?? "",
          affiliateEnabled: (meta.affiliateEnabled as boolean) ?? false,
          worldwideRights: restrictedCountries.length > 0 ? false : ((meta.worldwideRights as boolean) ?? true),
          restrictedCountries,
          copyrightHolder: (meta.copyrightHolder as string) ?? "",
          licenseType: (meta.licenseType as string) ?? "",
        }}
      />
    </DashboardShell>
  );
}
