"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { queueDuePayouts } from "@/actions/payouts";

/** Replaces the old automatic monthly cron (see the deleted
 * app/api/cron/monthly-payouts/route.ts) — an Admin clicks this to
 * compute who's owed what and queue it up as real PayoutRequest rows,
 * ready for the CSV/PDF exports and "Mark paid" below. Idempotent (see
 * actions/payouts.ts), so clicking it more than once in the same month
 * never double-queues anyone. */
export function QueuePayoutsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        className="btn btn-ghost btn-small"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await queueDuePayouts();
            if (!res.ok) setMessage(res.error ?? "Something went wrong.");
            else {
              setMessage(`Queued ${res.queued ?? 0} payout${res.queued === 1 ? "" : "s"}.`);
              router.refresh();
            }
          })
        }
      >
        {isPending ? "Queuing…" : "Queue this month's due payouts"}
      </button>
      {message && <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{message}</span>}
    </div>
  );
}
