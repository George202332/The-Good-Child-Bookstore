/**
 * A sale line is created the moment checkout starts, while its order is still
 * PENDING (the money split is worked out up front). It only becomes a real sale
 * when the order is confirmed PAID by Paystack/PayPal. Every list, total, count
 * or earnings figure that reads sale lines must therefore include this filter,
 * or an unpaid, abandoned or failed checkout would be counted as a sale.
 *
 * Use it as a relation filter:   saleLines: { ...PAID_ONLY, include: { book: true } }
 * or inside a query:             prisma.saleLine.findMany({ where: { ...PAID_ONLY.where } })
 */
export const PAID_ONLY = { where: { order: { status: "PAID" as const } } };
