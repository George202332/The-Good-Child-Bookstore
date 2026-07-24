import { PolicyPage } from "@/components/PolicyPage";

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Service"
      intro="The basics of using The Good Child Bookstore, in plain language."
      sections={[
        { heading: "Accounts", body: "You are responsible for keeping your login credentials secure and for activity on your account." },
        { heading: "Purchases", body: "Digital downloads are licensed for personal, non-commercial use. Print orders are fulfilled through our print-on-demand partner." },
        { heading: "Author and affiliate programs", body: "Authors retain rights to their work; submitting a title grants us a license to sell and distribute it through this platform. Affiliates earn commission under the terms shown in their dashboard." },
        { heading: "Changes", body: "We may update these terms as the platform grows; continued use of the site means you accept the current version." },
      ]}
    />
  );
}
