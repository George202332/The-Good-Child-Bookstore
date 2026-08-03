import { PolicyPage } from "@/components/PolicyPage";
import { getPagesContent } from "@/actions/page-content";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  const { returns } = await getPagesContent();
  return <PolicyPage title={returns.title} intro={returns.intro} sections={returns.sections} />;
}
