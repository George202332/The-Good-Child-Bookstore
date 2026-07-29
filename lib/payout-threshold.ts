/** Payouts below this amount are held over to the next monthly cycle
 * instead of being released — per explicit instruction, nothing under
 * $30 gets paid out on its own. It simply rolls forward and combines
 * with next month's earnings until the combined total clears $30. */
export const MIN_PAYOUT_AMOUNT = 30;
