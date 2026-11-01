/**
 * The pay routes at checkout (PayPal, card through Paystack, and a saved card), each with its own working state,
 * its own error and its own time limit. Pure, so the rules are tested.
 */

export type PayRoute = "paypal" | "card" | "saved";

/** How long one pay attempt may take (order check, Lulu price, gateway start-up) before the customer is told. */
export const ROUTE_TIMEOUT_MS = 30_000;

export class RouteTimeoutError extends Error {
  constructor() {
    super("The payment step took too long.");
    this.name = "RouteTimeoutError";
  }
}

/** Resolves with the work's result, or rejects with RouteTimeoutError after `ms`, so nothing spins forever. The
 * timer is always cleared. (The work itself cannot be cancelled; callers check `onTimeout` before acting late.) */
export function withTimeout<T>(work: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new RouteTimeoutError());
    }, ms);
    work.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

const NAME: Record<PayRoute, string> = { paypal: "PayPal", card: "card payment", saved: "saved card payment" };

/** What the customer is told when a route takes too long. Nothing was charged; the same order is reused on retry. */
export function timeoutMessage(route: PayRoute): string {
  return `The ${NAME[route]} took too long to start, so we stopped it. Nothing has been charged. Please press the button to try again; your order is kept, so you will not be charged twice.`;
}

/** What the customer is told when a route fails unexpectedly. */
export function failureMessage(route: PayRoute): string {
  return `The ${NAME[route]} could not be started because of a problem on our side. Nothing has been charged. Please try again in a moment.`;
}

/** The note shown on a button that is locked because ANOTHER route is paying. Never "Processing". */
export function lockNote(active: PayRoute | null, route: PayRoute): string | null {
  return active && active !== route ? "Payment in progress" : null;
}

/** The label of a route's own button while it is the one paying. Never "Processing". */
export function workingLabel(route: PayRoute): string {
  return route === "paypal" ? "Opening PayPal…" : route === "saved" ? "Charging your card…" : "Opening secure card payment…";
}
