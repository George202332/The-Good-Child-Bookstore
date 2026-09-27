"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getBookAuthorName } from "@/actions/books";
import { isFollowingAuthorName, toggleFollowAuthorName } from "@/actions/following";

/**
 * Converted from the az-follow-btn in detailHTML()
 * (the-good-child-bookstore_54_1.html:4272), which only ever showed a
 * toast ("Following X") — nothing was persisted. This is a real follow,
 * backed by the AuthorNameFollow table.
 *
 * Follows the exact author NAME shown on this book's card, not the
 * underlying account — per explicit instruction, the same account can
 * publish under a different pen name on a different book, and
 * following "J. Okoro" should only ever notify about new books under
 * that same name, pen name included.
 */
export function FollowAuthorButton({ bookId }: { bookId: string }) {
  const { data: session } = useSession();
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBookAuthorName(bookId).then(async (name) => {
      if (cancelled) return;
      setAuthorName(name);
      if (name && session?.user?.role === "READER") {
        const isFollowing = await isFollowingAuthorName(name);
        if (!cancelled) setFollowing(isFollowing);
      }
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, session?.user?.role]);

  async function handleClick() {
    if (!authorName) return;
    const res = await toggleFollowAuthorName(authorName);
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
    <button
      type="button"
      className={`az-follow-btn${following ? " is-following" : ""}`}
      onClick={handleClick}
      disabled={!ready || !authorName}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
