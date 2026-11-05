import { PolicyPage } from "@/components/PolicyPage";
import { getPagesContent } from "@/actions/page-content";
import { pageMeta } from "@/lib/seo/page-meta";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { faq } = await getPagesContent();
  return pageMeta({ title: faq.title, description: faq.intro, path: "/faq" });
}

export default async function FaqPage() {
  const { faq } = await getPagesContent();
  return <PolicyPage title={faq.title} intro={faq.intro} bodyHtml={faq.bodyHtml} />;
}
