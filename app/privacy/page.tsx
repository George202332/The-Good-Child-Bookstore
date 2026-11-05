import { PolicyPage } from "@/components/PolicyPage";
import { getPagesContent } from "@/actions/page-content";
import { pageMeta } from "@/lib/seo/page-meta";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { privacy } = await getPagesContent();
  return pageMeta({ title: privacy.title, description: privacy.intro, path: "/privacy" });
}

export default async function PrivacyPage() {
  const { privacy } = await getPagesContent();
  return <PolicyPage title={privacy.title} intro={privacy.intro} bodyHtml={privacy.bodyHtml} />;
}
