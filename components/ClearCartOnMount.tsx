"use client";

import { useEffect } from "react";
import { useCart } from "@/hooks/useCart";

/** Renders nothing — just clears the cart once this component actually
 * mounts, which only happens once the confirmation page has genuinely,
 * successfully loaded. This is deliberately NOT done on the checkout
 * page itself: clearing the cart there, then navigating away, created a
 * race where the checkout page could re-render its own "cart is empty"
 * state before the browser had actually finished moving to this page. */
export function ClearCartOnMount() {
  const { clear } = useCart();

  useEffect(() => {
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately runs once on mount only
  }, []);

  return null;
}
