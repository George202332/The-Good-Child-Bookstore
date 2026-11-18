/**
 * The payout lock window now lives in lib/payout-schedule.ts: details are locked ONLY from the lock day (10th) until
 * the payout is released (15th), and unlock the day after. Both days come from the admin setting. This file stays as
 * a thin re-export so older imports keep working.
 */
export { isPayoutDetailsLocked, payoutLockMessage, unlockDateLabel, failedPayoutMessage } from "@/lib/payout-schedule";
