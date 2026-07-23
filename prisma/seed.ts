/**
 * Seeds the database with the catalog demo data from lib/data/catalog.ts,
 * so foreign keys (SaleLine.bookId, etc.) resolve to real rows instead of
 * only existing as static fixtures. Each distinct author in the catalog
 * gets one placeholder User + AuthorProfile (email: catalog+<slug>@seed.
 * local, an unusable placeholder — real authors sign up normally and
 * publish their own books through the author dashboard once it exists).
 *
 * Run with: npx prisma db seed
 * (wired via the "prisma.seed" key in package.json)
 */
import { PrismaClient } from "@prisma/client";
import { BOOKS, CATS } from "../lib/data/catalog";

const prisma = new PrismaClient();

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  console.log(`Seeding ${BOOKS.length} catalog books...`);

  for (const cat of CATS) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name },
    });
  }

  // Same two codes the original frontend had hardcoded (WELCOME10/READMORE),
  // so checkout has working codes out of the box on a fresh deployment.
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: { code: "WELCOME10", percentOff: 10 },
  });
  await prisma.coupon.upsert({
    where: { code: "READMORE" },
    update: {},
    create: { code: "READMORE", percentOff: 15 },
  });

  const authorProfileIdByName = new Map<string, string>();

  for (const book of BOOKS) {
    let authorProfileId = authorProfileIdByName.get(book.author);
    if (!authorProfileId) {
      const email = `catalog+${slugify(book.author)}@seed.local`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name: book.author,
          passwordHash: "seed-placeholder-not-a-real-login",
          role: "AUTHOR",
          authorProfile: { create: {} },
        },
        include: { authorProfile: true },
      });
      const newAuthorProfileId: string = user.authorProfile!.id;
      authorProfileId = newAuthorProfileId;
      authorProfileIdByName.set(book.author, newAuthorProfileId);
    }

    await prisma.book.upsert({
      where: { slug: slugify(book.title) },
      update: {},
      create: {
        id: book.id, // keep IDs aligned with the catalog fixture (b1, b2, ...)
        title: book.title,
        slug: slugify(book.title),
        description: book.blurb,
        isbn: book.isbn,
        price: book.price,
        status: "PUBLISHED",
        authorId: authorProfileId,
        ageGroup: book.age,
        language: "en",
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
