"use server";

import { computeProcessingFee, type FeeRoute } from "@/lib/processing-fee";
import { getFeeRates } from "@/lib/processing-fee-settings";

/**
 * What checkout SHOWS for the Processing Fee: for an amount due on printed copies (books + postage + Lulu's fulfillment fee), the fee
 * for each way of paying. Display only: createPendingOrder works the real fee out again on the server with the same function and
 * refuses to charge a different amount than the one shown.
 */
export async function getProcessingFeeQuote(amountDue: number): Promise<Record<FeeRoute, number>> {
  const due = Number.isFinite(amountDue) && amountDue > 0 && amountDue < 100000 ? amountDue : 0;
  const rates = await getFeeRates();
  return {
    paystack: computeProcessingFee(due, rates.paystack).fee,
    mpesa: computeProcessingFee(due, rates.mpesa).fee,
    paypal: computeProcessingFee(due, rates.paypal).fee,
  };
}
