import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { accountingViewer } from "@/lib/accounting/guard";
import { getPaymentSafety } from "@/lib/api-keys";
import { variableGroups } from "@/lib/payment-env";
import { deploymentLabel, describeDatabase } from "@/lib/runtime-env";
import { readCheckHistory, readIncidents, readServiceHealth } from "@/lib/site-health/service-health";

export const dynamic = "force-dynamic";

/** Site Health as a PDF. Admin and Investor only. Contains service status, variable NAMES (present/missing), incidents and the latest checks; never a key. */
export async function GET() {
  if (!(await accountingViewer())) return new NextResponse("Not allowed.", { status: 403 });
  const [snap, safety, incidents, history] = await Promise.all([readServiceHealth(), getPaymentSafety(), readIncidents(100), readCheckHistory({ pageSize: 150 })]);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 40;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const clean = (t: string) => t.replace(/[^\x20-\x7E]/g, "?");
  const line = (text: string, o: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
    const size = o.size ?? 9.5;
    const f = o.bold ? bold : font;
    const maxW = W - 2 * M;
    const words = clean(text).split(" ");
    let cur = "";
    const out: string[] = [];
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > maxW && cur) { out.push(cur); cur = w; } else cur = t;
    }
    out.push(cur);
    for (const l of out) {
      if (y < M + size) { page = doc.addPage([W, H]); y = H - M; }
      page.drawText(l, { x: M, y, size, font: f, color: rgb(...(o.color ?? [0.1, 0.1, 0.1])) });
      y -= size + 3.5;
    }
  };
  const gap = (n = 6) => { y -= n; };
  const db = describeDatabase(process.env.DATABASE_URL, process.env.DATABASE_LABEL);
  const fmt = (d: Date | string) => new Date(d).toISOString().replace("T", " ").slice(0, 19) + " UTC";

  line("Site Health report", { size: 18, bold: true });
  line(`Generated ${fmt(new Date())}`);
  line(`Environment: ${deploymentLabel(safety.deployment)}. Active key set: ${safety.set === "live" ? "LIVE" : "TEST / sandbox"}.`);
  line(`Database: ${db ? `${db.label ? db.label + " - " : ""}${db.endpoint}${db.database ? " / " + db.database : ""}` : "not set"}`);
  for (const s of [safety.paystack, safety.paypal]) if (s.safeguard && s.reason) line(`SAFEGUARD: ${s.reason}`, { bold: true, color: [0.63, 0.15, 0.17] });
  gap();
  line("Services", { size: 13, bold: true });
  line(`Last automatic check: ${snap.lastRunAt ? fmt(snap.lastRunAt) : "not yet"}`);
  for (const r of snap.results) {
    line(`${r.ok ? "OK    " : "FAILED"}  ${r.label}  (${r.responseMs != null ? r.responseMs + " ms" : "-"})`, { bold: !r.ok, color: r.ok ? [0.1, 0.4, 0.2] : [0.63, 0.15, 0.17] });
    line(`      ${r.ok ? (r.note ?? "") : (r.reason ?? "")}`);
  }
  gap();
  line("Variables in this environment (names only)", { size: 13, bold: true });
  for (const g of variableGroups(safety.deployment)) {
    line(g.group, { bold: true });
    for (const n of g.names) line(`      ${process.env[n]?.trim() ? "present" : "MISSING"}  ${n}`);
  }
  gap();
  line("Incidents", { size: 13, bold: true });
  if (incidents.length === 0) line("None recorded.");
  for (const i of incidents) line(`${i.service}: started ${fmt(i.startedAt)}; ${i.resolvedAt ? "resolved " + fmt(i.resolvedAt) : "STILL DOWN"}; failed checks ${i.checksFailed}; ${i.lastError ?? ""}`);
  gap();
  line(`Latest checks (${history.rows.length} of ${history.total})`, { size: 13, bold: true });
  for (const r of history.rows) line(`${fmt(r.checkedAt)}  ${r.service}  ${r.ok ? "OK" : "FAILED"}  ${r.responseMs != null ? r.responseMs + " ms" : "-"}  ${r.error ?? ""}`, { size: 8 });

  const bytes = await doc.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="site-health-${new Date().toISOString().slice(0, 10)}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
