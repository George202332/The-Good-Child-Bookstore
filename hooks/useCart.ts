"use client";

import { useCallback, useEffect, useState } from "react";

export type CartFormat = "ebook" | "paperback" | "hardcover" | "audiobook";

export interface CartItem {
  bookId: string;
  format: CartFormat;
  quantity: number;
}

const CART_KEY = "gcb_cart";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("gcb-cart-changed"));
}

/** Mirrors the original frontend's localStorage-persisted cart, so the
 * cart badge in the header stays in sync across tabs/components without
 * a full page reload. */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    // Deliberate: localStorage isn't available during SSR, so state starts
    // empty and is synced here on mount — this is the hydration-safe
    // pattern, not an accidental cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readCart());
    const sync = () => setItems(readCart());
    window.addEventListener("gcb-cart-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gcb-cart-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addItem = useCallback((bookId: string, format: CartFormat, quantity = 1) => {
    const current = readCart();
    const existing = current.find((i) => i.bookId === bookId && i.format === format);
    const next = existing
      ? current.map((i) => (i.bookId === bookId && i.format === format ? { ...i, quantity: i.quantity + quantity } : i))
      : [...current, { bookId, format, quantity }];
    writeCart(next);
    setItems(next);
  }, []);

  const removeItem = useCallback((bookId: string, format: CartFormat) => {
    const next = readCart().filter((i) => !(i.bookId === bookId && i.format === format));
    writeCart(next);
    setItems(next);
  }, []);

  /** Converted from setQty() (the-good-child-bookstore_54_1.html:2283-2286):
   * setting to 0 or below removes the item entirely. */
  const setQty = useCallback((bookId: string, format: CartFormat, quantity: number) => {
    const current = readCart();
    const next =
      quantity <= 0
        ? current.filter((i) => !(i.bookId === bookId && i.format === format))
        : current.map((i) => (i.bookId === bookId && i.format === format ? { ...i, quantity } : i));
    writeCart(next);
    setItems(next);
  }, []);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, count, addItem, removeItem, setQty };
}
