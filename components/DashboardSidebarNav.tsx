"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";
import { NAV_ICONS } from "./nav-icons";

interface NavItem {
  key: string;
  label: string;
  href: string;
  section: string;
  badge?: number;
}

interface NavSection {
  name: string;
  items: NavItem[];
}

/**
 * The dashboard sidebar nav, split out of DashboardShell.tsx into its
 * own client component purely so it can hold open/closed state — the
 * desktop layout (CSS grid, sidebar always visible) is unchanged, but
 * on mobile (<=1024px, see .dashboard-sidebar in app/site.css) the
 * sidebar is an off-canvas panel that was completely unreachable: the
 * CSS for a hamburger toggle + slide-out panel + dimmed overlay already
 * existed (.dashboard-mobile-toggle, .dashboard-mobile-overlay, the
 * `.open` modifier on .dashboard-sidebar), but nothing in the markup
 * ever rendered the toggle button or tracked whether the panel was
 * open — so Author and Reader accounts (and anyone else using this
 * shell) had no way at all to reach Dashboard, Publish a Book,
 * Analytics, Payouts, Profile, etc. on a phone.
 */
export function DashboardSidebarNav({
  sections,
  activeKey,
  unreadSidebarKeys,
  displayName,
}: {
  sections: NavSection[];
  activeKey: string;
  unreadSidebarKeys: string[];
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const unread = new Set(unreadSidebarKeys);

  // Close the panel on every navigation — otherwise tapping a nav link
  // would leave the overlay/panel sitting open over the newly-loaded
  // page. Adjusting state during render (the React-recommended pattern
  // for "reset state when a prop/value changes") rather than in an
  // effect, so the close happens in the same render as the navigation
  // instead of one tick later.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Close on Escape, same as any other dismissible overlay on the site
  // (see Modal.tsx) — keeps keyboard behavior consistent site-wide.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="dashboard-mobile-toggle"
        aria-expanded={open}
        aria-controls="dashboard-sidebar-nav"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        Menu
      </button>

      {/* Dimmed backdrop, mobile-only (see .dashboard-mobile-overlay) —
          clicking it closes the panel, same as clicking outside any
          other overlay/modal on the site. */}
      <div
        className={`dashboard-mobile-overlay${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`dashboard-sidebar${open ? " open" : ""}`}
        id="dashboard-sidebar-nav"
        aria-label={`Account menu for ${displayName}`}
      >
        <nav aria-label="Account navigation">
          {sections.map((sec) => (
            <div className="dashboard-nav-group" key={sec.name}>
              <div className="dashboard-nav-section-label">{sec.name}</div>
              {sec.items.map((it) => (
                <Link
                  key={it.key}
                  href={it.href}
                  className={`dashboard-nav-link ${activeKey === it.key ? "active" : ""}`}
                  aria-current={activeKey === it.key ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {NAV_ICONS[it.key] ? (
                    <span className={`dashboard-nav-icon ${unread.has(it.key) && activeKey !== it.key ? "has-unread" : ""}`}>
                      {NAV_ICONS[it.key]}
                      {unread.has(it.key) && activeKey !== it.key && <span className="dashboard-nav-blink-dot" aria-label="New notification" />}
                    </span>
                  ) : null}
                  <span>{it.label}</span>
                  {it.badge ? <span className="nav-badge">{it.badge}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <SignOutButton />
      </aside>
    </>
  );
}
