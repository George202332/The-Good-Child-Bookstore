import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { getSiteSettings } from "@/actions/site-settings";
import { EditBookTabs, type EditTab } from "./EditBookTabs";
import { buildEbookInitial, buildPrintInitial, classify, sharedPrefill, type BookWithRelations } from "./edit-initials";

/**
 * Edit an existing book — genuinely the same page used to submit a new
 * title, in edit mode, with the same two tabs ("eBook / Audiobook" and
 * "Print Copy"). Each format of a title is its own edition (its own book
 * record), so each tab edits its own edition: every field pre-filled from
 * that edition, not a separate, simplified form. Saving resubmits an
 * unpublished edition for review; a published edition saves live and only
 * a replaced manuscript or cover goes to review. A format the title does
 * not have yet can be added from its tab.
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
  if (!book || book.authorId !== user.authorProfile.id || book.deletedByAuthorAt) notFound();

  const settings = await getSiteSettings();

  // The other edition of this title, if there is one: same author, same
  // title, the other kind of edition (print vs eBook/audiobook).
  const isPrintRow = (b: { hasPrint: boolean; hasEbook: boolean; hasAudiobook: boolean }) => b.hasPrint && !b.hasEbook && !b.hasAudiobook;
  const isCombined = book.hasPrint && (book.hasEbook || book.hasAudiobook);
  let sibling: BookWithRelations | null = null;
  if (!isCombined) {
    const candidates = await prisma.book.findMany({
      where: { authorId: user.authorProfile.id, id: { not: book.id }, deletedByAuthorAt: null, title: { equals: book.title, mode: "insensitive" } },
      include: { categories: { include: { category: true } }, genres: { include: { genre: true } }, files: true },
      orderBy: { createdAt: "desc" },
    });
    sibling = candidates.find((c: BookWithRelations) => !(c.hasPrint && (c.hasEbook || c.hasAudiobook)) && isPrintRow(c) !== isPrintRow(book)) ?? null;
  }

  const thisIsPrint = isPrintRow(book);
  const ebookBook = thisIsPrint ? sibling : book;
  const printBook = thisIsPrint ? book : sibling;

  const ebookTab: EditTab = ebookBook ? { mode: "edit", status: ebookBook.status } : { mode: "add" };
  const printTab: EditTab = printBook ? { mode: "edit", status: printBook.status } : { mode: "add" };
  const ebookInitial = ebookBook ? buildEbookInitial(ebookBook) : undefined;
  const printInitial = printBook ? buildPrintInitial(printBook) : undefined;
  const sharedSource = ebookBook ?? printBook ?? book;
  const classification = classify(sharedSource);
  const sharedMeta = (sharedSource.submissionMetadata as Record<string, unknown> | null) ?? {};
  // The eBook's uploaded file, so "Autofill from eBook" on the Print tab can carry it across.
  const ebookFileRef = ebookBook?.files.find((f: { kind: string; url: string }) => f.kind === "MANUSCRIPT")?.url.split("/").pop();
  const ebookFile = ebookFileRef ? await prisma.uploadedFile.findUnique({ where: { id: ebookFileRef }, select: { id: true, originalName: true, mimeType: true } }) : null;
  const manuscriptInfo = ebookFile ? { id: ebookFile.id, name: ebookFile.originalName, mimeType: ebookFile.mimeType } : undefined;

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
          {isCombined && (
            <p style={{ color: "var(--ink-faint)", fontSize: 12.5, marginTop: 4 }}>
              This title was created with its eBook and print editions together, so both are edited here; its print settings are kept as they are.
            </p>
          )}
        </div>
      </div>
      {isCombined ? (
        <EditBookTabs
          startOn="ebook"
          enabledFormats={settings.publishingFormatsEnabled}
          ebookTab={{ mode: "edit", status: book.status }}
          printTab={{ mode: "edit", status: book.status }}
          ebookInitial={buildEbookInitial(book)}
          printInitial={undefined}
          addPrefill={sharedPrefill(book, classification, sharedMeta)}
          combined
        />
      ) : (
        <EditBookTabs
          startOn={thisIsPrint ? "print" : "ebook"}
          enabledFormats={settings.publishingFormatsEnabled}
          ebookTab={ebookTab}
          printTab={printTab}
          ebookInitial={ebookInitial}
          printInitial={printInitial}
          addPrefill={sharedPrefill(sharedSource, classification, sharedMeta, manuscriptInfo)}
        />
      )}
    </DashboardShell>
  );
}
