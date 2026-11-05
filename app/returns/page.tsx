import { PolicyPage } from "@/components/PolicyPage";
import { getPagesContent } from "@/actions/page-content";
import { pageMeta } from "@/lib/seo/page-meta";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { returns } = await getPagesContent();
  return pageMeta({ title: returns.title, description: returns.intro, path: "/returns" });
}

export default async function ReturnsPage() {
  const { returns } = await getPagesContent();
  return <PolicyPage title={returns.title} intro={returns.intro} bodyHtml={returns.bodyHtml} />;
}
