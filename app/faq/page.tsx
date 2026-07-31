import { PolicyPage } from "@/components/PolicyPage";

export default function FaqPage() {
  return (
    <PolicyPage
      title="Frequently Asked Questions"
      intro="Quick answers to what we get asked most."
      sections={[
        { heading: "How do I download a book I bought?", body: "Purchased books appear in My Library immediately after checkout, with a Download button on each title." },
        { heading: "Can I become an author on this platform?", body: "Yes — sign up for an author account and submit your title through our editorial review process." },
        { heading: "How does the affiliate program work?", body: "Any account, reader or author, can enable affiliate access and start earning commission on referrals and promoted book links." },
        { heading: "What payment methods do you accept?", body: "Cards via Paystack, including Visa, Mastercard, American Express, and Verve." },
        { heading: "Is this platform safe for children to browse?", body: "Yes — every listing is age-tagged honestly, and there is no third-party advertising anywhere on the site." },
      ]}
    />
  );
}
