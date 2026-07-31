import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { EditBookForm } from "./EditBookForm";

/**
 * Edit an existing book — core details only (title, description,
 * pricing, category/genre, age group, language, cover, formats).
 * Saving resubmits the book for review, per explicit instruction.
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
    include: { categories: { include: { category: true } }, genres: { include: { genre: true } } },
  });
  if (!book || book.authorId !== user.authorProfile.id) notFound();

  return (
    <DashboardShell role="AUTHOR" activeKey="mybooks" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Edit: {book.title}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Saving these changes resubmits the book for review.
          </p>
        </div>
      </div>
      <EditBookForm
        initial={{
          bookId: book.id,
          title: book.title,
          subtitle: book.subtitle ?? "",
          description: book.description ?? "",
          price: Number(book.price),
          ageGroup: book.ageGroup ?? "",
          category: book.categories[0]?.category.name ?? "",
          genre: book.genres[0]?.genre.name ?? "",
          language: book.language ?? "en",
          coverImageUrl: book.coverImageUrl ?? "",
          samplePageUrls: book.samplePageUrls,
          formats: { ebook: book.hasEbook, print: book.hasPrint, audiobook: book.hasAudiobook },
        }}
      />
    </DashboardShell>
  );
}
