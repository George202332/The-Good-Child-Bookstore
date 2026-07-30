"use server";

import { prisma } from "@/lib/prisma";
import { getRequestGeo } from "@/lib/geo";

export async function recordBlogRead(blogId: string): Promise<void> {
  try {
    const geo = await getRequestGeo();
    await prisma.blogRead.create({ data: { blogId, country: geo.country, region: geo.region } });
  } catch {
    // A missed read log is never worth breaking the page over.
  }
}
