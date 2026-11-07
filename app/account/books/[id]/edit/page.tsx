import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { getSiteSettings } from "@/actions/site-settings";
import { EditBookTabs, type EditTab } from "./EditBookTabs";
import { authorRevisionStatus, type HeldFullRevision } from "@/lib/revision-state";
import { buildEbookInitial, buildPrintInitial, classify, sharedPrefill, withDraftEdit, type BookWithRelations } from "./edit-initials";

/**
 * Edit an existing book — genuinely the same page used to submit a new
 * title, in edit mode, with the same two tabs ("eBook and Audiobook" and
 * "Print"). Each format of a title is its own edition (its own book
 * record), so each tab edits its own edition: every field pre-filled from
 * that edition, not a separate, simplified form. Saving resubmits an
 * unpublished edition for review; every edit of a published edition is held for review while the approved version stays live. A format the title does
 * not have yet can be added from its tab.
 */
export default async function EditBookPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ edition?: string }> }) {
  const { id } = await params;
  const editionParam = (await searchParams)?.edition;
  const only: "ebook" | "print" | undefined = editionParam === "print" || editionParam === "ebook" ? editionParam : undefined;
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

  const ebookTab: EditTab = ebookBook ? { mode: "edit", status: ebookBook.status, bookId: ebookBook.id } : { mode: "add" };
  const printTab: EditTab = printBook ? { mode: "edit", status: printBook.status, bookId: printBook.id } : { mode: "add" };
  // The form shows the author's own edit (draft, awaiting review, or sent back) when there is one, not the approved version.
  const ebookInitial = ebookBook ? buildEbookInitial(withDraftEdit(ebookBook)) : undefined;
  const printInitial = printBook ? buildPrintInitial(withDraftEdit(printBook)) : undefined;
  const statusLines = ([["eBook/Audiobook", ebookBook], ["Print Book", printBook]] as const).flatMap(([label, b]) => {
    if (!b) return [];
    const meta = (b.submissionMetadata as { lastRevisionOutcome?: { state?: string } } | null) ?? {};
    const status = authorRevisionStatus(b.pendingRevisionData, meta.lastRevisionOutcome);
    if (!status) return [];
    const note = status === "Needs Attention" ? (b.pendingRevisionData as unknown as HeldFullRevision | null)?.note : undefined;
    return [{ label, status, note }];
  });
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
          <h2 style={{ fontSize: 15.5 }}>{only === "print" && !printBook ? "Add Print Book" : only === "ebook" && !ebookBook ? "Add eBook/Audiobook Edition" : "Edit"}: {book.title}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            {book.status === "PUBLISHED"
              ? "Every change is reviewed before it goes live. Your current approved version stays on sale until the new one is approved."
              : "Saving these changes resubmits the book for review."}
          </p>
          {isCombined && (
            <p style={{ color: "var(--ink-faint)", fontSize: 12.5, marginTop: 4 }}>
              This title was created with its eBook and print editions together, so both are edited here; its print settings are kept as they are.
            </p>
          )}
        </div>
      </div>
      {statusLines.map((l) => (
        <div key={l.label} role="status" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, fontSize: 13.5, background: l.status === "Needs Attention" ? "#FDECEA" : l.status === "Approved" ? "#E3F4EA" : "#FFF4D6", border: `1px solid ${l.status === "Needs Attention" ? "#F3B6AE" : l.status === "Approved" ? "#B9E0C8" : "#F0DDA0"}`, color: "#3a3226" }}>
          <strong>{l.label}: {l.status}.</strong>{" "}
          {l.status === "Awaiting Review" && "Your changes are with our reviewers. Your approved version stays on sale until they are approved."}
          {l.status === "Draft Saved" && "Your draft is saved here. Your approved version is still on sale. Press Republish when you are ready to send it for review."}
          {l.status === "Needs Attention" && <>The reviewer sent your changes back{l.note ? <>: &ldquo;{l.note}&rdquo;</> : "."} Your approved version is still on sale. Change what was asked and press Republish.</>}
          {l.status === "Approved" && "Your last changes were approved and are live."}
        </div>
      ))}
      {isCombined ? (
        <EditBookTabs
          startOn="ebook"
          enabledFormats={settings.publishingFormatsEnabled}
          ebookTab={{ mode: "edit", status: book.status, bookId: book.id }}
          printTab={{ mode: "edit", status: book.status, bookId: book.id }}
          ebookInitial={buildEbookInitial(withDraftEdit(book))}
          printInitial={undefined}
          addPrefill={sharedPrefill(book, classification, sharedMeta)}
          combined
        />
      ) : (
        <EditBookTabs
          startOn={only ?? (thisIsPrint ? "print" : "ebook")}
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
