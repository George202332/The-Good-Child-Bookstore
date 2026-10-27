/**
 * READ-ONLY report: who OWNS each blog post?
 *
 * A writer's "My Blogs" page lists the posts whose owner is that writer's own
 * account. A post can be live on the public blog yet missing from the writer's
 * list when it was saved under a different account (for example the staff/admin
 * account, when the same browser was signed in to both). This lists every post
 * with its owner, flags the ones that look filed under the wrong account, and
 * counts them. It changes NOTHING.
 *
 * Usage (PowerShell, from the bookstore folder), pointing at the database to check:
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/report-blog-owners.ts
 * (The connection string is read from your environment and never printed.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const STAFF_ROLES = new Set(["ADMIN", "EDITOR", "CHIEF_EDITOR", "ACCOUNTANT", "INVESTOR"]);

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const [blogs, users] = await Promise.all([
    prisma.blog.findMany({
      select: {
        id: true, title: true, slug: true, status: true, createdAt: true,
        authorFirstName: true, authorLastName: true,
        author: { select: { id: true, accountNumber: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({ select: { id: true, accountNumber: true, name: true, email: true, role: true } }),
  ]);

  const byName = new Map<string, typeof users>();
  for (const u of users) {
    const k = norm(u.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(u);
  }

  console.log(`Blog posts in total: ${blogs.length}`);
  const flagged: string[] = [];
  for (const b of blogs) {
    const byline = `${b.authorFirstName ?? ""} ${b.authorLastName ?? ""}`.trim();
    const owner = b.author;
    const reasons: string[] = [];
    if (STAFF_ROLES.has(owner.role)) reasons.push(`owned by a staff account (${owner.role})`);
    if (byline && norm(byline) !== norm(owner.name)) {
      const match = (byName.get(norm(byline)) ?? []).filter((u) => u.id !== owner.id);
      if (match.length > 0) {
        reasons.push(`byline "${byline}" matches other account(s): ${match.map((u) => `${u.accountNumber} <${u.email}> ${u.role}`).join("; ")}`);
      }
    }
    console.log(`\n- "${b.title}" [${b.status}] ${b.createdAt.toISOString().slice(0, 10)}  /blog/${b.slug}`);
    console.log(`    owner: ${owner.accountNumber}  ${owner.name} <${owner.email}>  (${owner.role})${byline ? `   byline: ${byline}` : ""}`);
    if (reasons.length) {
      flagged.push(b.id);
      console.log(`    ** LOOKS MISFILED: ${reasons.join(" | ")}`);
      console.log(`    post id: ${b.id}`);
    }
  }
  console.log(`\nPosts that look filed under the wrong account: ${flagged.length}`);
  console.log("Nothing was changed.");
}

main()
  .catch((e) => {
    console.error("Report failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
