import { PolicyPage } from "@/components/PolicyPage";
import { getPagesContent } from "@/actions/page-content";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const { privacy } = await getPagesContent();
  return <PolicyPage title={privacy.title} intro={privacy.intro} sections={privacy.sections} />;
}
