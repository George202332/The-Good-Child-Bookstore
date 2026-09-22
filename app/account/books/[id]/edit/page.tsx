import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { EbookSubmissionForm } from "../../new/EbookSubmissionForm";

/**
 * Edit an existing book — genuinely the same page used to submit a new
 * title (see app/account/books/new/EbookSubmissionForm.tsx), in edit
 * mode: every field pre-filled from the existing book, not a
 * separate, simplified form. Saving resubmits the book for review,
 * per explicit instruction.
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
  const meta = (book.submissionMetadata as Record<string, unknown> | null) ?? {};

  return (
    <DashboardShell role="AUTHOR" activeKey="mybooks" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Edit: {book.title}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Saving these changes resubmits the book for review.
          </p>
        </div>
      </div>
      <EbookSubmissionForm
        initial={{
          bookId: book.id,
          manuscriptFileId,
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
          category: book.categories[0]?.category.name ?? "",
          genre: book.genres[0]?.genre.name ?? "",
          ageGroup: book.ageGroup ?? "",
          readingLevel: (meta.readingLevel as string) ?? "",
          descriptionHtml: (meta.longDescriptionHtml as string) ?? book.description ?? "",
          keywords: typeof meta.keywords === "string" ? (meta.keywords as string).split(",").map((k) => k.trim()).filter(Boolean) : [],
          price: String(Number(book.price)),
          discountPrice: meta.discountPrice != null ? String(meta.discountPrice) : "",
          taxSetting: (meta.taxSetting as string) ?? "",
          sellOnStore: (meta.sellOnStore as boolean) ?? true,
          featuredRequest: (meta.featuredRequest as boolean) ?? false,
          affiliateEnabled: (meta.affiliateEnabled as boolean) ?? false,
          worldwideRights: (meta.worldwideRights as boolean) ?? true,
          countryRestrictions: (meta.countryRestrictions as string) ?? "",
          copyrightHolder: (meta.copyrightHolder as string) ?? "",
          licenseType: (meta.licenseType as string) ?? "",
        }}
      />
    </DashboardShell>
  );
}
