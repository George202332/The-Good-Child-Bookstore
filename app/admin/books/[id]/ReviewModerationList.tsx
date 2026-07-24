"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReviewAsModerator } from "@/actions/book-management";
import type { BookReviewRow } from "@/actions/book-management";

export function ReviewModerationList({ reviews }: { reviews: BookReviewRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (reviews.length === 0) {
    return <div style={{ padding: "20px 0", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13 }}>No reviews yet.</div>;
  }

  return (
    <div className="map-card" style={{ padding: "6px 16px" }}>
      {reviews.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.reviewerName}</div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>
              {r.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
            <p style={{ fontSize: 13.5 }}>{r.content}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Delete this review?")) return;
              startTransition(async () => {
                await deleteReviewAsModerator(r.id);
                router.refresh();
              });
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
