"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitBlogForReview } from "@/actions/blog";

export function SubmitButton({ blogId }: { blogId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-ghost btn-small"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await submitBlogForReview(blogId);
          router.refresh();
        })
      }
    >
      Submit for review
    </button>
  );
}
