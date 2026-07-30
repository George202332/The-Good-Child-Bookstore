"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBookSuspended } from "@/actions/submissions";

export function SuspendButton({ bookId, suspended }: { bookId: string; suspended: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 6 }}>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          disabled={isPending}
          onClick={() => startTransition(async () => { await setBookSuspended(bookId, !suspended); setConfirming(false); router.refresh(); })}
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
      {suspended ? "Restore" : "Suspend"}
    </button>
  );
}
