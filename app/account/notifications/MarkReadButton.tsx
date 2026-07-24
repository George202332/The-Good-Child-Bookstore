"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/actions/notifications";

export function MarkReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-small"
      disabled={isPending}
      onClick={() => startTransition(async () => { await markAllNotificationsRead(); router.refresh(); })}
    >
      Mark all as read
    </button>
  );
}
