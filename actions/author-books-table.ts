import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface AuthorBookTableRow {
  title: string;
  authorDisplayName: string;
  category: string;
  organic: number;
  ebook: number;
  audiobook: number;
  paperback: number;
  hardcover: number;
  copies: number;
}

/** Every one of the signed-in author's books with a full sales
 * breakdown — organic-channel count alongside a per-format count, and
 * the total copies sold across every format combined. Pure numbers,
 * matching the rest of the Sales analytics page. */
export async function getAuthorBooksTable(): Promise<AuthorBookTableRow[]> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return [];

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      authorProfile: {
        include: {
          books: {
            include: {
              saleLines: true,
              categories: { include: { category: true } },
            },
          },
        },
      },
    },
  });

  const penName = user?.authorProfile?.penName;
  const authorDisplayName = penName || user?.name || "";
  const books = (user?.authorProfile?.books ?? []) as {
    title: string;
    categories: { category: { name: string } }[];
    saleLines: { saleType: string; format: string | null }[];
  }[];

  return books.map((b) => {
    let organic = 0, ebook = 0, audiobook = 0, paperback = 0, hardcover = 0;
    for (const l of b.saleLines) {
      if (l.saleType === "ORGANIC") organic += 1;
      if (l.format === "EBOOK") ebook += 1;
      else if (l.format === "AUDIOBOOK") audiobook += 1;
      else if (l.format === "PAPERBACK") paperback += 1;
      else if (l.format === "HARDCOVER") hardcover += 1;
    }
    return {
      title: b.title,
      authorDisplayName,
      category: b.categories[0]?.category.name ?? "—",
      organic,
      ebook,
      audiobook,
      paperback,
      hardcover,
      copies: b.saleLines.length,
    };
  });
}
