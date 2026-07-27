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
export function SiteChrome({ children, settings }: { children: ReactNode; settings: SiteSettings }) {
  const pathname = usePathname();
  const isBackend = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/login";

  if (isBackend) return <>{children}</>;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Suspense fallback={null}>
        <Header logoImageUrl={settings.logoImageUrl} />
      </Suspense>
      <div style={{ flex: 1 }}>{children}</div>
      <Footer
        minimal={isLoginPage}
        logoImageUrl={settings.logoImageUrl}
        footerTagline={settings.footerTagline}
        footerCopyright={settings.footerCopyright}
        paymentBadges={settings.paymentBadges}
      />
    </div>
  );
}
