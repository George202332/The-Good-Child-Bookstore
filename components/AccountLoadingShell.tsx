"use client";

import { useSyncExternalStore } from "react";
import { NAV_PENDING_KEY, NAV_SNAPSHOT_KEY } from "./account-nav-keys";
import { NAV_ICONS } from "./nav-icons";

/**
 * What an account page shows the instant a menu item is clicked, while the real page is still being made on the server:
 * the same sidebar (with the clicked item already highlighted) and soft grey blocks where the page content will appear.
 * It only draws; it never fetches anything and holds no personal data beyond the menu labels already on screen.
 */
interface Snap { sections: { name: string; items: { key: string; label: string }[] }[] }

const none = () => () => {};
function read(k: string): string | null { try { return sessionStorage.getItem(k); } catch { return null; } }

export function AccountLoadingShell() {
  const raw = useSyncExternalStore(none, () => read(NAV_SNAPSHOT_KEY), () => null);
  const pending = useSyncExternalStore(none, () => read(NAV_PENDING_KEY), () => null);
  let snap: Snap | null = null;
  try { snap = raw ? (JSON.parse(raw) as Snap) : null; } catch { snap = null; }

  return (
    <>
      <aside className="dashboard-sidebar" aria-hidden="true">
        {snap ? snap.sections.map((sec) => (
          <div className="dashboard-nav-group" key={sec.name}>
            <div className="dashboard-nav-section-label">{sec.name}</div>
            {sec.items.map((it) => (
              <span key={it.key} className={`dashboard-nav-link ${pending === it.key ? "active" : ""}`}>
                {NAV_ICONS[it.key] ? <span className="dashboard-nav-icon">{NAV_ICONS[it.key]}</span> : null}
                <span>{it.label}</span>
              </span>
            ))}
          </div>
        )) : Array.from({ length: 8 }, (_, i) => <div key={i} className="skel skel-nav" />)}
      </aside>
      <main className="dashboard-content" aria-busy="true" aria-label="Loading">
        <div className="skel skel-title" />
        <div className="skel-row"><div className="skel skel-card" /><div className="skel skel-card" /><div className="skel skel-card" /></div>
        <div className="skel skel-block" />
        <div className="skel skel-block" style={{ height: 120 }} />
      </main>
    </>
  );
}
