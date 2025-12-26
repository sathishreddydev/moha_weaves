ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "razorpay_refund_id" text;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "razorpay_payment_id" text;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "failure_reason" text;
ALTER TABLE "refunds" ADD COLUMN IF NOT EXISTS "retry_count" integer DEFAULT 0;

ALTER TABLE "refunds" DROP COLUMN IF EXISTS "stripe_refund_id";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refunds_order_id_orders_id_fk'
  ) THEN
    ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refunds_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "refunds" ADD CONSTRAINT "refunds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refunds_return_request_id_return_requests_id_fk'
  ) THEN
    ALTER TABLE "refunds" ADD CONSTRAINT "refunds_return_request_id_return_requests_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_requests"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
