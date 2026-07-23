"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getBookAuthorId } from "@/actions/books";
import { isFollowingAuthor, toggleFollowAuthor } from "@/actions/following";

/**
 * Converted from the az-follow-btn in detailHTML()
 * (the-good-child-bookstore_54_1.html:4272), which only ever showed a
 * toast ("Following X") — nothing was persisted. This is a real follow,
 * backed by the AuthorFollow table.
 */
export function FollowAuthorButton({ bookId }: { bookId: string }) {
  const { data: session } = useSession();
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBookAuthorId(bookId).then(async (id) => {
      if (cancelled) return;
      setAuthorId(id);
      if (id && session?.user?.role === "READER") {
        const isFollowing = await isFollowingAuthor(id);
        if (!cancelled) setFollowing(isFollowing);
      }
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, session?.user?.role]);

  async function handleClick() {
    if (!authorId) return;
    const res = await toggleFollowAuthor(authorId);
    if (res.ok && typeof res.following === "boolean") setFollowing(res.following);
  }

  if (!session || session.user.role !== "READER") {
    return (
      <button type="button" className="az-follow-btn" disabled>
        Follow
      </button>
    );
  }

  return (
    <button type="button" className="az-follow-btn" onClick={handleClick} disabled={!ready || !authorId}>
      {following ? "Following" : "Follow"}
    </button>
  );
}
