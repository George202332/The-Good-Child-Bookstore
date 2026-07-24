import { PolicyPage } from "@/components/PolicyPage";

export default function ReturnsPage() {
  return (
    <PolicyPage
      title="Returns Policy"
      intro="Because most of what we sell is delivered instantly, our returns policy is a little different from a typical store."
      sections={[
        { heading: "Digital downloads", body: "eBooks are available in your Library the moment checkout completes. If a file is damaged or won't open, contact us within 7 days for a replacement or refund." },
        { heading: "Print copies", body: "Printed books can be returned within 30 days if they arrive damaged or defective. Contact us with your order number and we will arrange a reprint or refund." },
        { heading: "Subscriptions", body: "You can pause or cancel your Book Club subscription at any time from your account; charges already processed for the current month are non-refundable." },
      ]}
    />
  );
}
