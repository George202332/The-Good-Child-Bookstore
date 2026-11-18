import { redirect } from "next/navigation";

/** Old conversation links (from notifications and emails) open the new inbox with that conversation selected. */
export default async function MessageThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  redirect(`/account/messages?c=${encodeURIComponent(userId)}`);
}
