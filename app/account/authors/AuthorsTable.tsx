"use client";

import { useRouter } from "next/navigation";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";
import type { AuthorsDirectoryRow } from "@/actions/authors-directory";

/** Clicking anywhere in a row opens that author's public profile page —
 * the same page components/FollowAuthorButton.tsx and the product
 * page's "About the Author" link both point at. */
export function AuthorsTable({ authors }: { authors: AuthorsDirectoryRow[] }) {
  const router = useRouter();

  function openProfile(a: AuthorsDirectoryRow) {
    router.push(`/authors/profile/${a.authorId}?name=${encodeURIComponent(a.name)}`);
  }

  return (
    <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={TH_STYLE}>Author</th>
            <th style={TH_STYLE}>Followers</th>
            <th style={TH_STYLE}>Published books</th>
            <th style={TH_STYLE}>Primary genre</th>
          </tr>
        </thead>
        <tbody>
          {authors.map((a) => (
            <tr
              key={`${a.authorId}-${a.name}`}
              onClick={() => openProfile(a)}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-hover, rgba(0,0,0,0.03))")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={{ ...TD_STYLE, fontWeight: 700 }}>{a.name}</td>
              <td style={TD_STYLE}>{a.followerCount}</td>
              <td style={TD_STYLE}>{a.bookCount}</td>
              <td style={TD_STYLE}>{a.primaryGenre ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
