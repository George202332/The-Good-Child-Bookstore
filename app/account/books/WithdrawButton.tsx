"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withdrawBook } from "@/actions/submissions";

export function WithdrawButton({ bookId, alreadyWithdrawn }: { bookId: string; alreadyWithdrawn: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (alreadyWithdrawn) {
    return <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Withdrawn</span>;
  }

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 6 }}>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          disabled={isPending}
          onClick={() => startTransition(async () => { await withdrawBook(bookId); setConfirming(false); router.refresh(); })}
        >
          {isPending ? "…" : "Confirm"}
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirming(true)}>
      Withdraw
    </button>
  );
}
