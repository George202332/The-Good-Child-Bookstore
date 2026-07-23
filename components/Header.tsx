"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { SearchIcon, HeartIcon, BagIcon, UserIcon } from "./icons";
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
  { href: "/shop", label: "Bookshelf", match: "shop" },
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

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = routeMatch(pathname);
  const { data: session } = useSession();
  const { count: cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();
  const [search, setSearch] = useState("");

  // Keep the box in sync with ?q= when already on /shop (e.g. back/forward
  // nav, or a filter chip removed elsewhere), without fighting local typing.
  useEffect(() => {
    if (pathname === "/shop") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch(searchParams.get("q") ?? "");
    }
  }, [pathname, searchParams]);

  // Converted from the global-search input listener in attachHeaderHandlers()
  // (the-good-child-bookstore_54_1.html:15175-15185): typing here live-
  // navigates to /shop with the query applied, same as the original jumping
  // to #/shop on the first keystroke.
  function handleSearchChange(value: string) {
    setSearch(value);
    const params = new URLSearchParams(pathname === "/shop" ? searchParams.toString() : "");
    if (value) params.set("q", value);
    else params.delete("q");
    params.delete("page");
    router.replace(`/shop?${params.toString()}`, { scroll: false });
  }

  const user = session?.user;
  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Logo />
        <nav className="main-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={active === item.match ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <label className="search-pill">
            <SearchIcon />
            <input
              id="global-search"
              type="text"
              placeholder="Search titles or authors"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </label>
          <Link href="/wishlist" className="cart-btn" aria-label="Wishlist">
            <HeartIcon />
            <span className="cart-count" id="wishlist-count">
              {wishlistCount}
            </span>
          </Link>
          <Link href="/cart" className="cart-btn" aria-label="Cart">
            <BagIcon />
            <span className="cart-count" id="cart-count">
              {cartCount}
            </span>
          </Link>
          <Link
            href={user ? "/account" : "/login"}
            className="cart-btn"
            aria-label="My account"
            title={user ? `My account (${user.name})` : "Sign in"}
          >
            {user ? (
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--coral)",
                  color: "var(--ink)",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {initials}
              </span>
            ) : (
              <UserIcon />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
