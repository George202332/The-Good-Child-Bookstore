import { getPagesContent } from "@/actions/page-content";
import { ContactPageClient } from "./ContactPageClient";
import { pageMeta } from "@/lib/seo/page-meta";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return pageMeta({ title: "Contact Us", description: "Contact The Good Child Bookstore about an order, a book, publishing as an author or becoming an affiliate. A real person replies.", path: "/contact" });
}

export default async function ContactPage() {
  const { contact } = await getPagesContent();
  return <ContactPageClient eyebrow={contact.eyebrow} heading={contact.heading} introText={contact.introText} bodyHtml={contact.bodyHtml} />;
}
