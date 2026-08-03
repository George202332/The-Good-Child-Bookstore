import { PolicyPage } from "@/components/PolicyPage";
import { getPagesContent } from "@/actions/page-content";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const { faq } = await getPagesContent();
  return <PolicyPage title={faq.title} intro={faq.intro} sections={faq.sections} />;
}
