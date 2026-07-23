"use client";

import { useCallback, useEffect, useState } from "react";

const WISHLIST_KEY = "gcb_wishlist";

function readWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeWishlist(ids: string[]) {
  window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("gcb-wishlist-changed"));
}

export function useWishlist() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    // Deliberate: localStorage isn't available during SSR, so state starts
    // empty and is synced here on mount — this is the hydration-safe
    // pattern, not an accidental cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds(readWishlist());
    const sync = () => setIds(readWishlist());
    window.addEventListener("gcb-wishlist-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gcb-wishlist-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((bookId: string) => {
    const current = readWishlist();
    const next = current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId];
    writeWishlist(next);
    setIds(next);
  }, []);

  return { ids, count: ids.length, toggle, has: (bookId: string) => ids.includes(bookId) };
}
