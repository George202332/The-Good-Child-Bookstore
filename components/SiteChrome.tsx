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
 * both. /admin is a separate backend surface (AdminShell already
 * provides its own sidebar/nav) — showing the public site's nav and
 * footer around it as well just doubles up navigation and looks wrong,
 * which is exactly what was reported. Everything else (storefront pages,
 * and the reader/author/affiliate dashboards under /account, which the
 * original always showed inside the same site chrome) keeps the normal
 * header/footer.
 */
export function SiteChrome({ children, settings, userRole }: { children: ReactNode; settings: SiteSettings; userRole?: string }) {
  const pathname = usePathname();
  const isBackend = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/login";
  const isAccountPage = pathname.startsWith("/account");
  const hideFooter = isLoginPage || isAccountPage;
  // Authors don't see the public site header anywhere in their account;
  // readers still do — this only applies within /account, and only for
  // the AUTHOR role specifically.
  const hideHeader = isAccountPage && userRole === "AUTHOR";

  if (isBackend) return <>{children}</>;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {!hideHeader && (
        <Suspense fallback={null}>
          <Header logoImageUrl={settings.logoImageUrl} />
        </Suspense>
      )}
      <div style={{ flex: 1, ...(hideHeader ? { paddingTop: "0.5in" } : {}) }}>{children}</div>
      {!hideFooter && (
        <Footer
          minimal={false}
          logoImageUrl={settings.logoImageUrl}
          footerTagline={settings.footerTagline}
          footerCopyright={settings.footerCopyright}
          paymentBadges={settings.paymentBadges}
        />
      )}
    </div>
  );
}
