/**
 * Refund cron job — polls Razorpay every 15 minutes for any refunds that are
 * stuck in "processing" status (i.e. the webhook was missed or delayed).
 *
 * This is a pure setInterval-based scheduler — no extra dependency needed.
 */

import { RefundWebhookService } from "../refund/refundWebhook";

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let cronHandle: ReturnType<typeof setInterval> | null = null;

async function runRefundCheck(): Promise<void> {
  console.log("[RefundCron] Running pending refund check...");
  try {
    await RefundWebhookService.checkPendingRefunds();
    console.log("[RefundCron] Pending refund check complete.");
  } catch (err) {
    console.error("[RefundCron] Error during pending refund check:", err);
  }
}

export function startRefundCron(): void {
  if (cronHandle) {
    console.warn("[RefundCron] Already running — skipping duplicate start.");
    return;
  }

  // Run once immediately on startup so we catch anything missed during downtime
  runRefundCheck();

  cronHandle = setInterval(runRefundCheck, INTERVAL_MS);
  console.log(`[RefundCron] Started — polling every ${INTERVAL_MS / 60_000} minutes.`);
}

export function stopRefundCron(): void {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
    console.log("[RefundCron] Stopped.");
  }
}
