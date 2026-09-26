"use client";

import Link from "next/link";
import type { AdminConversationRow } from "@/actions/admin-messages";
import { SUPPORT_CATEGORIES } from "@/actions/messages";

function initialsFor(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function categoryLabel(category: string | null): string | null {
  if (!category) return null;
  return SUPPORT_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}

/** Mirrors the Inbox tab of the author-side Messages page — same idea
 * (one row per conversation, newest first, unread ones marked), styled
 * for the dark admin theme instead of reusing the storefront's
 * light-theme inbox classes, which aren't meant for this shell. */
export function AdminMessagesList({ conversations }: { conversations: AdminConversationRow[] }) {
  if (conversations.length === 0) {
    return (
      <div className="map-card" style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "var(--admin-text)" }}>No support messages yet</div>
        <p style={{ color: "var(--admin-text-faint)", fontSize: 13 }}>
          Messages authors and readers send to Support will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="map-card" style={{ padding: 0 }}>
      {conversations.map((c) => (
        <Link
          key={c.counterpartId}
          href={`/admin/messages/${c.counterpartId}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderBottom: "1px solid var(--admin-border)",
            textDecoration: "none",
            color: "inherit",
            background: c.unread ? "var(--admin-panel-hover)" : "transparent",
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--admin-accent-soft)", color: "var(--admin-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {initialsFor(c.counterpartName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--admin-text)" }}>{c.counterpartName}</span>
              <span className="age-pill">{c.counterpartRole}</span>
              {categoryLabel(c.category) && <span className="age-pill">{categoryLabel(c.category)}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--admin-text-faint)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {c.lastMessage}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: "var(--admin-text-faint)" }}>
              {c.lastMessageAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            {c.unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--admin-accent)" }} aria-label="Unread" />}
          </div>
        </Link>
      ))}
    </div>
  );
}
