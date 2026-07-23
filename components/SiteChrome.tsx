"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

/**
 * Decides whether the public storefront header/footer should wrap the
 * current page. /admin is a separate backend surface (AdminShell already
 * provides its own sidebar/nav) — showing the public site's nav and
 * footer around it as well just doubles up navigation and looks wrong,
 * which is exactly what was reported. Everything else (storefront pages,
 * and the reader/author/affiliate dashboards under /account, which the
 * original always showed inside the same site chrome) keeps the normal
 * header/footer.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isBackend = pathname.startsWith("/admin");

  if (isBackend) return <>{children}</>;

  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      {children}
      <Footer />
    </>
  );
}
