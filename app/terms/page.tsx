import { PolicyPage } from "@/components/PolicyPage";
import { getPagesContent } from "@/actions/page-content";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const { terms } = await getPagesContent();
  return <PolicyPage title={terms.title} intro={terms.intro} sections={terms.sections} />;
}
