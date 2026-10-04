"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import type { SiteSettings } from "@/lib/site-settings";

/**
 * Decides whether the public storefront header/footer should wrap the
 * current page, and forwards the admin-editable site settings (logo,
 * footer text, payment badge images — see /admin/site-settings) down to
 * both. /admin and /investor are both separate backend surfaces
 * (AdminShell/InvestorShell each already provide their own sidebar/nav)
 * — showing the public site's nav and footer around them as well just
 * doubles up navigation and looks wrong, which is exactly what was
 * reported. /investor was missing from this check entirely (added
 * after this component was last touched), which meant every Investor
 * page — despite being correctly access-gated behind the backend login
 * the whole time — visually rendered sandwiched inside the public
 * storefront header and footer, making a backend-only, admin-created
 * account's pages look like part of the public front end even though
 * they never actually were reachable by anyone without backend
 * credentials. Everything else (storefront pages, and the
 * reader/author/affiliate dashboards under /account) keeps the normal
 * full header — Authors used to get a stripped-down header with just a
 * greeting and no nav, which meant they had to sign out to shop; they
 * now get the exact same Header as everyone else (nav, search,
 * wishlist/cart/account icons), and a purchase they make there is
 * attributed to their own existing account (see resolveReaderProfileId
 * in actions/orders.ts) rather than routed through guest checkout.
 */
export function SiteChrome({ children, settings }: { children: ReactNode; settings: SiteSettings }) {
  const pathname = usePathname();
  const isBackend = pathname.startsWith("/admin") || pathname.startsWith("/investor");
  const isLoginPage = pathname === "/login";
  const isAccountPage = pathname.startsWith("/account");
  const hideFooter = isLoginPage || isAccountPage;

  if (isBackend) return <>{children}</>;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Suspense fallback={null}>
        <Header logoImageUrl={settings.logoImageUrl} />
      </Suspense>
      <div style={{ flex: 1 }}>{children}</div>
      {!hideFooter && (
        <Footer
          minimal={false}
          logoImageUrl={settings.logoImageUrl}
          footerTagline={settings.footerTagline}
          footerCopyright={settings.footerCopyright}
          paymentBadges={settings.paymentBadges}
          socialLinks={settings.socialLinks}
        />
      )}
    </div>
  );
}
