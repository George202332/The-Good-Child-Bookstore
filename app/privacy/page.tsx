import { PolicyPage } from "@/components/PolicyPage";

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      intro="How The Good Child Bookstore collects, uses, and protects your information."
      sections={[
        { heading: "What we collect", body: "Account details you provide (name, email, shipping and billing address), order history, and basic usage data to keep the store running smoothly." },
        { heading: "How we use it", body: "To process orders, deliver digital downloads, run your subscription, pay author royalties and affiliate commissions, and improve recommendations." },
        { heading: "What we never do", body: "We don't sell your data to third parties, and we don't run third-party advertising on this site." },
        { heading: "Your choices", body: "You can review, export, or request deletion of your account data at any time from Security settings in your account." },
      ]}
    />
  );
}
