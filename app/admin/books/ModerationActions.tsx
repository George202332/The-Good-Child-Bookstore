"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBook, rejectBook } from "@/actions/admin";

export function ModerationActions({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {error && <span style={{ fontSize: 12, color: "var(--coral-deep)" }}>{error}</span>}
      <button
        type="button"
        className="btn btn-primary btn-small"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await approveBook(bookId);
            if (!res.ok) setError(res.error ?? "Failed");
            else router.refresh();
          })
        }
      >
        Approve
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-small"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await rejectBook(bookId);
            if (!res.ok) setError(res.error ?? "Failed");
            else router.refresh();
          })
        }
      >
        Reject
      </button>
    </div>
  );
}
