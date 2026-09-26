import Link from "next/link";

/**
 * Plain text wordmark, per explicit instruction: no icon, no uploaded
 * image, no graphics of any kind — just "The Good Child Bookstore" set
 * in the site's own Times New Roman, sitting on the same background as
 * the rest of the header. Replaces the earlier owl-mark icon (dropped
 * from icons.tsx as dead code) and the admin-uploaded-logo-image branch;
 * the Site Settings logo upload field still exists for anyone who wants
 * it for other branding uses, but the header/footer no longer render it.
 * `logoImageUrl` is still accepted (existing callers pass it) but is no
 * longer used, so it can't cause a build error while it's still wired
 * up in SiteChrome/site-settings.
 */
export function Logo({ subColor, logoImageUrl }: { subColor?: string; logoImageUrl?: string }) {
  void subColor;
  void logoImageUrl;
  return (
    <Link href="/" className="logo logo-wordmark">
      The Good Child Bookstore
    </Link>
  );
}
