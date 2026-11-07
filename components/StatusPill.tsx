/** A small coloured pill for a plain-word status in a table (Paid, Pending, Refunded ...). It only changes how the word looks. */
const TONE: Record<string, string> = {
  paid: "status-paid", completed: "status-paid", complete: "status-paid", success: "status-paid", succeeded: "status-paid", fulfilled: "status-paid", approved: "status-paid", delivered: "status-paid",
  pending: "status-pending", processing: "status-pending", review: "status-review", shipped: "status-on-review",
  failed: "status-attention", cancelled: "status-draft", canceled: "status-draft", refunded: "status-draft-purple", expired: "status-draft",
};
export function StatusPill({ status }: { status: string | null | undefined }) {
  const text = String(status ?? "").trim();
  if (!text) return <>—</>;
  const tone = TONE[text.toLowerCase()] ?? "status-draft";
  return <span className={`status-pill ${tone}`} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11 }}>{text}</span>;
}
