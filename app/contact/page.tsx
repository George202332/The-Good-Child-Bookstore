import { getPagesContent } from "@/actions/page-content";
import { ContactPageClient } from "./ContactPageClient";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const { contact } = await getPagesContent();
  return <ContactPageClient eyebrow={contact.eyebrow} heading={contact.heading} introText={contact.introText} />;
}
