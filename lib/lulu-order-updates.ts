/**
 * Pure rules (no database, no network) for the updates a buyer gets about a print order.
 *
 * Lulu's own print-job statuses are CREATED, UNPAID, PAYMENT_IN_PROGRESS, PRODUCTION_DELAYED, PRODUCTION_READY,
 * IN_PRODUCTION, SHIPPED, REJECTED and CANCELED. Lulu has NO "Printed" and NO "Delivered" status, so those two updates are
 * never sent: we do not invent a status Lulu did not give.
 */
export type BuyerUpdateKind = "ON_HOLD" | "IN_PROGRESS" | "SHIPPED";

export function updateKindForStatus(status: string | null | undefined): BuyerUpdateKind | null {
  switch ((status ?? "").toUpperCase()) {
    case "REJECTED":
    case "PRODUCTION_DELAYED": return "ON_HOLD";
    case "PRODUCTION_READY":
    case "IN_PRODUCTION": return "IN_PROGRESS";
    case "SHIPPED": return "SHIPPED";
    default: return null;
  }
}

export const ON_HOLD_TEXT = "Your order is on hold while we resolve a printing issue";

/** The tracking link from Lulu's print job (line_items[].tracking_urls), only if it is a normal web address. */
export function trackingFromPrintJob(json: unknown): { url: string | null; id: string | null } {
  const items = json && typeof json === "object" ? (json as Record<string, unknown>).line_items : null;
  if (!Array.isArray(items)) return { url: null, id: null };
  for (const it of items as Record<string, unknown>[]) {
    const urls = Array.isArray(it?.tracking_urls) ? (it.tracking_urls as unknown[]) : [];
    const url = urls.find((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u)) ?? null;
    const id = typeof it?.tracking_id === "string" && it.tracking_id.trim() ? it.tracking_id.trim().slice(0, 80) : null;
    if (url || id) return { url, id };
  }
  return { url: null, id: null };
}

/** A buyer is on hold while the rejection is open (it is cleared when the author's fixed file is sent again). */
export function isOnHold(luluRejectedAt: Date | string | null | undefined): boolean {
  return !!luluRejectedAt;
}

export function buyerUpdateText(kind: BuyerUpdateKind, title: string, orderNo: string, tracking?: { url: string | null; id: string | null }): { subject: string; body: string } {
  switch (kind) {
    case "ON_HOLD":
      return { subject: `Order ${orderNo} is on hold`, body: `${ON_HOLD_TEXT}.\n\nBook: ${title}\nOrder: ${orderNo}\n\nYour order is safe and nothing more is needed from you. We will tell you as soon as printing starts. You have not been charged anything extra.` };
    case "IN_PROGRESS":
      return { subject: `Order ${orderNo} is being printed`, body: `Good news: our print partner has accepted your order and printing is in progress.\n\nBook: ${title}\nOrder: ${orderNo}` };
    case "SHIPPED": {
      const track = tracking?.url ? `\nTrack your parcel: ${tracking.url}` : tracking?.id ? `\nTracking number: ${tracking.id}` : "";
      return { subject: `Order ${orderNo} has shipped`, body: `Your order is on its way.\n\nBook: ${title}\nOrder: ${orderNo}${track}` };
    }
  }
}
