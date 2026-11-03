"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { accountingAdmin, accountingViewer } from "@/lib/accounting/guard";
import { buildAccountingView, buildDrill, type AccountingView, type Drill } from "@/lib/accounting/service";
import { closeMonthNow, reopenMonthNow, resendReportNow, writeChangeLog, type CloseResult } from "@/lib/accounting/close";
import { receiptProblem, sniffReceiptType, validateExpense } from "@/lib/accounting/expense-input";
import { isMonthKey } from "@/lib/accounting/period";
import type { Metric } from "@/lib/accounting/calc";

/**
 * Everything the Accounting tab does. READING is open to Admin and Investor; every WRITE (expenses, closing, reopening,
 * re-sending the report) checks, on the server, that the signed-in account is an Admin. An investor calling any of the
 * write actions gets "Only an Admin can do this." and nothing is changed.
 */

const NOT_ADMIN = "Only an Admin can do this.";

const METRICS: Metric[] = [
  "customersPaid", "companyGrossShare", "referralCommissions", "salesRevenue", "acctRoyalties", "acctReferral", "acctPromotion", "acctGross", "totalRevenue",
  "georgeRoyalty", "enteredExpenses", "authorTax", "profit", "incomeTax", "retained", "authorRoyalties", "referralEarnings", "promotionCommissions",
  "luluPrinting", "luluShipping", "luluFulfillment",
];

function refresh() {
  revalidatePath("/admin/accounting");
  revalidatePath("/investor/accounting");
}

export async function getAccountingView(selection: string, includeTest: boolean): Promise<AccountingView | null> {
  if (!(await accountingViewer())) return null;
  return buildAccountingView(selection === "lifetime" || isMonthKey(selection) ? selection : "lifetime", includeTest);
}

export async function getAccountingDrill(selection: string, metric: string, includeTest: boolean): Promise<Drill | null> {
  if (!(await accountingViewer())) return null;
  if (!METRICS.includes(metric as Metric)) return null;
  return buildDrill(selection === "lifetime" || isMonthKey(selection) ? selection : "lifetime", metric as Metric, includeTest);
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

async function monthIsClosed(monthKey: string): Promise<boolean> {
  const row = await prisma.accountingMonth.findUnique({ where: { monthKey }, select: { status: true } });
  return row?.status === "CLOSED";
}

const LOCKED = "That month is closed, so its expenses are locked. Reopen the month first (the change is logged).";

/** Adds an expense (no "id" in the form) or edits one (with "id"). Optional "receipt" file; "removeReceipt=1" detaches it. */
export async function saveExpense(formData: FormData): Promise<ActionResult> {
  const actor = await accountingAdmin();
  if (!actor) return { ok: false, error: NOT_ADMIN };

  const checked = validateExpense({ date: formData.get("date"), category: formData.get("category"), description: formData.get("description"), amount: formData.get("amount") });
  if (!checked.ok) return { ok: false, error: checked.error };
  const v = checked.value;
  const id = typeof formData.get("id") === "string" && formData.get("id") ? String(formData.get("id")) : null;

  const existing = id ? await prisma.accountingExpense.findUnique({ where: { id } }) : null;
  if (id && !existing) return { ok: false, error: "That expense no longer exists." };
  if (await monthIsClosed(v.monthKey)) return { ok: false, error: LOCKED };
  if (existing && existing.monthKey !== v.monthKey && (await monthIsClosed(existing.monthKey))) return { ok: false, error: LOCKED };

  let receiptId: string | null | undefined = undefined; // undefined = leave as it is
  let receiptName: string | null | undefined = undefined;
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    const problem = receiptProblem({ name: file.name, type: file.type, size: file.size });
    if (problem) return { ok: false, error: problem };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const real = sniffReceiptType(bytes);
    if (!real) return { ok: false, error: "That file does not look like a PDF, JPG, PNG or WebP image." };
    const saved = await prisma.accountingReceipt.create({ data: { data: bytes, mimeType: real, originalName: file.name.slice(0, 200) } });
    receiptId = saved.id;
    receiptName = file.name.slice(0, 200);
  } else if (formData.get("removeReceipt") === "1") {
    receiptId = null;
    receiptName = null;
  }

  const amount = (v.amountCents / 100).toFixed(2);
  const expenseDate = new Date(`${v.date}T00:00:00.000Z`);
  if (!existing) {
    const created = await prisma.accountingExpense.create({
      data: {
        expenseDate, monthKey: v.monthKey, category: v.category, description: v.description, amount,
        receiptFileId: receiptId ?? null, receiptName: receiptName ?? null, enteredById: actor.id, enteredByName: actor.name,
      },
    });
    await writeChangeLog(v.monthKey, actor, "EXPENSE_ADDED", `Expense added: ${v.category}, ${v.description}, $${amount} (${v.date}).`, { id: created.id, receipt: receiptName ?? null });
  } else {
    const before = { date: existing.expenseDate.toISOString().slice(0, 10), category: existing.category, description: existing.description, amount: Number(existing.amount).toFixed(2), receipt: existing.receiptName };
    await prisma.accountingExpense.update({
      where: { id: existing.id },
      data: {
        expenseDate, monthKey: v.monthKey, category: v.category, description: v.description, amount,
        ...(receiptId !== undefined ? { receiptFileId: receiptId, receiptName } : {}),
        updatedById: actor.id, updatedByName: actor.name, updatedAt: new Date(),
      },
    });
    const after = { date: v.date, category: v.category, description: v.description, amount, receipt: receiptName === undefined ? existing.receiptName : receiptName };
    await writeChangeLog(v.monthKey, actor, "EXPENSE_EDITED", `Expense edited: ${v.category}, ${v.description}, was $${before.amount}, now $${amount}.`, { id: existing.id, before, after });
    if (existing.monthKey !== v.monthKey) await writeChangeLog(existing.monthKey, actor, "EXPENSE_EDITED", `An expense moved out of this month to ${v.monthKey} ($${before.amount}, ${before.description}).`, { id: existing.id, before, after });
    // The old receipt is only removed once nothing points at it any more.
    if (receiptId !== undefined && existing.receiptFileId && existing.receiptFileId !== receiptId) {
      await prisma.accountingReceipt.deleteMany({ where: { id: existing.receiptFileId } });
    }
  }
  refresh();
  return { ok: true, message: existing ? "Expense updated." : "Expense added." };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const actor = await accountingAdmin();
  if (!actor) return { ok: false, error: NOT_ADMIN };
  const existing = await prisma.accountingExpense.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "That expense no longer exists." };
  if (await monthIsClosed(existing.monthKey)) return { ok: false, error: LOCKED };
  await prisma.accountingExpense.delete({ where: { id } });
  if (existing.receiptFileId) await prisma.accountingReceipt.deleteMany({ where: { id: existing.receiptFileId } });
  await writeChangeLog(existing.monthKey, actor, "EXPENSE_DELETED", `Expense deleted: ${existing.category}, ${existing.description}, $${Number(existing.amount).toFixed(2)} (${existing.expenseDate.toISOString().slice(0, 10)}).`, {
    id, category: existing.category, description: existing.description, amount: Number(existing.amount).toFixed(2), receipt: existing.receiptName,
  });
  refresh();
  return { ok: true, message: "Expense deleted." };
}

export async function closeMonth(monthKey: string, includeTest: boolean): Promise<CloseResult> {
  const actor = await accountingAdmin();
  if (!actor) return { ok: false, error: NOT_ADMIN };
  const res = await closeMonthNow(actor, monthKey, includeTest);
  refresh();
  return res;
}

export async function reopenMonth(monthKey: string, reason: string): Promise<ActionResult> {
  const actor = await accountingAdmin();
  if (!actor) return { ok: false, error: NOT_ADMIN };
  const res = await reopenMonthNow(actor, monthKey, reason);
  refresh();
  return res.ok ? { ok: true, message: "Month reopened. Its figures are live again until you close it." } : res;
}

export async function resendReport(monthKey: string): Promise<CloseResult> {
  const actor = await accountingAdmin();
  if (!actor) return { ok: false, error: NOT_ADMIN };
  const res = await resendReportNow(actor, monthKey);
  refresh();
  return res;
}
