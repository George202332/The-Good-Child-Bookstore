"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { SearchIcon, HeartIcon, BagIcon, UserIcon } from "./icons";
import { headerSearchTarget, headerSearchUrl, HEADER_SEARCH_PLACEHOLDER } from "@/lib/header-search";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";

/**
 * Converted from headerHTML(route) in the original frontend
 * (the-good-child-bookstore_54_1.html:3228). Same markup/classes, same
 * nav items in the same order, same search pill + wishlist/cart/account
 * icon-button cluster — just driven by Next.js routing and hooks instead
 * of the original hash router and localStorage reads inlined into a
 * template string.
 */
const NAV_ITEMS = [
  { href: "/", label: "Home", match: "home" },
  { href: "/bookshelf", label: "Bookshelf", match: "bookshelf" },
  { href: "/authors", label: "Authorship", match: "authors" },
  { href: "/affiliate", label: "Affiliate", match: "affiliate" },
  { href: "/blog", label: "Blog", match: "blog" },
  { href: "/contact", label: "Contact us", match: "contact" },
];

function routeMatch(pathname: string): string {
  if (pathname === "/") return "home";
  const seg = pathname.split("/")[1];
  return seg || "home";
}

export function Header({ logoImageUrl }: { logoImageUrl?: string } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = routeMatch(pathname);
  // /account/** (and every route under it) shows the dashboard sidebar
  // nav's mobile panel instead of the main-site nav dropdown when the
  // shared hamburger (see .header-mobile-toggle below) is tapped — the
  // main-site nav only makes sense once you're back on the public
  // storefront. There's only ever the ONE hamburger button now
  // (Amendment 10); this flag just decides which panel it opens.
  const isDashboardRoute = pathname.startsWith("/account");
  const { data: session } = useSession();
  const { count: cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const searchTarget = headerSearchTarget(pathname);
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the mobile nav on every navigation, same pattern as the
  // dashboard sidebar's mobile panel (DashboardSidebarNav.tsx) — adjusting
  // state during render rather than in an effect so the close happens in
  // the same render as the navigation instead of one tick later.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileNavOpen(false);
    // Leaving the Blog listing: don't carry a blog search into the book
    // search (or a blog post) the visitor is now looking at.
    if (lastPathname === "/blog") setSearch("");
  }

  // Close on Escape, same as the dashboard sidebar's mobile panel and any
  // other dismissible overlay on the site (see Modal.tsx).
  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);
  // A backend account (Admin/Editor/Accountant) signed in at /admin/login
  // is a real, valid session — but it has no business being shown as
  // "signed in" on the storefront, which is what made it look like
  // "logging into the backend also logs in the front end". Only a
  // Reader/Author/Affiliate session counts as signed-in here.
  const backendRole = (session?.user as { role?: string } | undefined)?.role;
  const isBackendSession = backendRole === "ADMIN" || backendRole === "EDITOR" || backendRole === "ACCOUNTANT";

  // Keep the box in sync with ?q= when already on /bookshelf (e.g. back/forward
  // nav, or a filter chip removed elsewhere), without fighting local typing.
  useEffect(() => {
    if (pathname === "/bookshelf" || searchTarget === "blog") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch(searchParams.get("q") ?? "");
    }
  }, [pathname, searchParams, searchTarget]);

  // Converted from the global-search input listener in attachHeaderHandlers()
  // (the-good-child-bookstore_54_1.html:15175-15185): typing here live-
  // navigates to /bookshelf with the query applied, same as the original jumping
  // to #/bookshelf on the first keystroke.
  function handleSearchChange(value: string) {
    setSearch(value);
    // Only while ON the Blog listing page does this box search blog
    // posts (staying on /blog); on every other page — an individual blog
    // post included — it searches books exactly as before.
    const keepParams = pathname === "/bookshelf" || searchTarget === "blog" ? searchParams.toString() : "";
    router.replace(headerSearchUrl(searchTarget, value, keepParams), { scroll: false });
  }

  // The dashboard sidebar's own mobile panel (DashboardSidebarNav.tsx)
  // lives inside DashboardShell, not here — but Amendment 10 wants ONE
  // shared hamburger button, positioned the same place (between the
  // logo and the wishlist icon) on every route, including /account.
  // Since Header and DashboardSidebarNav don't share a React parent
  // below the root layout, the button here just dispatches a plain
  // window CustomEvent that DashboardSidebarNav listens for to toggle
  // its own `open` state, and DashboardSidebarNav dispatches its state
  // back on every change so this button's aria-expanded stays accurate
  // — the simplest way to keep one visual toggle in sync with state
  // that necessarily still lives with the panel it opens.
  const [dashboardNavOpen, setDashboardNavOpen] = useState(false);
  useEffect(() => {
    if (!isDashboardRoute) return;
    function onState(e: Event) {
      setDashboardNavOpen((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener("dashboard-mobile-nav-state", onState as EventListener);
    return () => window.removeEventListener("dashboard-mobile-nav-state", onState as EventListener);
  }, [isDashboardRoute]);

  function toggleMobileMenu() {
    if (isDashboardRoute) {
      window.dispatchEvent(new CustomEvent("dashboard-mobile-nav-toggle"));
    } else {
      setMobileNavOpen((o) => !o);
    }
  }

  const user = isBackendSession ? undefined : session?.user;
  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Logo logoImageUrl={logoImageUrl} />
        <nav className="main-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={active === item.match ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          {/* One shared mobile hamburger — sits between the logo and the
              wishlist icon (Amendment 10), not on its own row below the
              header any more, and not labeled "Menu" any more: icon-only,
              5 lines (was 3). On /account routes this opens the dashboard
              sidebar panel instead of the main-site nav menu — see
              toggleMobileMenu/dashboardNavOpen above. */}
          <button
            type="button"
            className="header-mobile-toggle"
            aria-expanded={isDashboardRoute ? dashboardNavOpen : mobileNavOpen}
            aria-controls={isDashboardRoute ? "dashboard-sidebar-nav" : "mobile-nav-menu"}
            aria-label="Menu"
            onClick={toggleMobileMenu}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M4 5h16M4 9h16M4 13h16M4 17h16M4 21h16" />
            </svg>
          </button>
          <label className="search-pill">
            <SearchIcon />
            <input
              id="global-search"
              type="text"
              placeholder={HEADER_SEARCH_PLACEHOLDER[searchTarget]}
              aria-label={searchTarget === "blog" ? "Search blog posts" : "Search books"}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </label>
          <Link href="/wishlist" className="header-icon-btn" aria-label="Wishlist">
            <span className="cart-btn">
              <HeartIcon size={16} />
              <span className="cart-count" id="wishlist-count">
                {wishlistCount}
              </span>
            </span>
          </Link>
          <Link href="/cart" className="header-icon-btn" aria-label="Cart">
            <span className="cart-btn">
              <BagIcon size={16} />
              <span className="cart-count" id="cart-count">
                {cartCount}
              </span>
            </span>
          </Link>
          <Link
            href={user ? "/account" : "/login"}
            className="header-icon-btn"
            aria-label="My account"
            title={user ? `My account (${user.name})` : "Sign in"}
          >
            <span className="cart-btn">
            {user ? (
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 7,
                  background: "var(--coral)",
                  color: "var(--ink)",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {initials}
              </span>
            ) : (
              <UserIcon size={16} />
            )}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile-only nav dropdown, shown at the same breakpoint the
          desktop nav.main-nav disappears at. The toggle button that
          opens this now lives up in .header-actions, between the logo
          and the wishlist icon (Amendment 10) — this is just the panel
          it opens, with no toggle button of its own any more. */}
      {!isDashboardRoute && (
        <nav
          id="mobile-nav-menu"
          className={`wrap mobile-nav-menu${mobileNavOpen ? " open" : ""}`}
          aria-label="Mobile navigation"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={active === item.match ? "active" : ""}
              onClick={() => setMobileNavOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
