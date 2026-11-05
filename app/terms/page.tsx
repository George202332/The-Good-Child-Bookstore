import { PolicyPage } from "@/components/PolicyPage";
import { getPagesContent } from "@/actions/page-content";
import { pageMeta } from "@/lib/seo/page-meta";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { terms } = await getPagesContent();
  return pageMeta({ title: terms.title, description: terms.intro, path: "/terms" });
}

export default async function TermsPage() {
  const { terms } = await getPagesContent();
  return <PolicyPage title={terms.title} intro={terms.intro} bodyHtml={terms.bodyHtml} />;
}
