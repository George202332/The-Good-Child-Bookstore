import { PrismaClient } from "@prisma/client";
import { tunedDatabaseUrl } from "@/lib/db-url";
import { noteSlowQuery } from "@/lib/site-health/slow-queries";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient(): PrismaClient {
  const url = tunedDatabaseUrl(process.env.DATABASE_URL);
  const client = new PrismaClient({
    ...(url ? { datasourceUrl: url } : {}),
    log: [{ emit: "event", level: "query" }],
  });
  // Remember queries slower than the limit (text only, never the values) so Site Health can list them.
  (client as unknown as { $on: (e: "query", cb: (q: { query: string; duration: number }) => void) => void }).$on("query", (q) => noteSlowQuery(q.query, q.duration));
  return client;
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
