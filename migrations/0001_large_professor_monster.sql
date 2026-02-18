ALTER TABLE "store_sales" ADD COLUMN "razorpay_order_id" text;--> statement-breakpoint
ALTER TABLE "store_sales" ADD COLUMN "razorpay_payment_id" text;--> statement-breakpoint
ALTER TABLE "store_sales" ADD COLUMN "razorpay_signature" text;