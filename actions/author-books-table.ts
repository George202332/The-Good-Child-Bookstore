import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface AuthorBookTableRow {
  title: string;
  authorDisplayName: string;
  category: string;
  ebook: number;
  audiobook: number;
  paperback: number;
  hardcover: number;
  copies: number;
}

/** Every one of the signed-in author's books with a full per-format
 * sales breakdown, and the total copies sold across every format
 * combined. Pure numbers, matching the rest of the Sales analytics
 * page. Sorted by copies sold, most to least. */
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

  const rows = books.map((b) => {
    let ebook = 0, audiobook = 0, paperback = 0, hardcover = 0;
    for (const l of b.saleLines) {
      // SaleLine.format is stored lowercase ("ebook", "paperback",
      // "hardcover", "audiobook") — matching exactly what checkout
      // actually writes (see actions/orders.ts).
      if (l.format === "ebook") ebook += 1;
      else if (l.format === "audiobook") audiobook += 1;
      else if (l.format === "paperback") paperback += 1;
      else if (l.format === "hardcover") hardcover += 1;
    }
    return {
      title: b.title,
      authorDisplayName,
      category: b.categories[0]?.category.name ?? "—",
      ebook,
      audiobook,
      paperback,
      hardcover,
      copies: b.saleLines.length,
    };
  });

  return rows.sort((a, b) => b.copies - a.copies);
}
