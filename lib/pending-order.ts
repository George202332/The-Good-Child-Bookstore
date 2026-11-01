/**
 * Decides whether an order the customer already has waiting (PENDING, unpaid) is the very same purchase as the one
 * being created, so a retry, a double click or switching between PayPal and card reuses it instead of creating a
 * duplicate. Pure, so the rule is tested.
 */

export interface OrderLineKey {
  bookId: string;
  format: string | null;
  /** The line's amount, in dollars. */
  gross: number;
}

const keyOf = (l: OrderLineKey) => `${l.bookId}|${l.format ?? ""}|${l.gross.toFixed(2)}`;

/** True when both have exactly the same books, formats and line amounts (order does not matter). */
export function sameOrderLines(a: OrderLineKey[], b: OrderLineKey[]): boolean {
  if (a.length !== b.length) return false;
  const x = a.map(keyOf).sort();
  const y = b.map(keyOf).sort();
  return x.every((v, i) => v === y[i]);
}

/** How long a waiting order may be reused. */
export const PENDING_REUSE_MINUTES = 30;
