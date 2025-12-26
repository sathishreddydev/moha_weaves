ALTER TYPE "public"."refund_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "product_reviews" DROP CONSTRAINT "product_reviews_user_name_users_name_fk";
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_method" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_method" SET DEFAULT 'razorpay'::text;--> statement-breakpoint
DROP TYPE "public"."payment_method";--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('razorpay');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_method" SET DEFAULT 'razorpay'::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_method" SET DATA TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "razorpay_refund_id" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "razorpay_payment_id" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "product_reviews" DROP COLUMN "user_name";--> statement-breakpoint
ALTER TABLE "refunds" DROP COLUMN "stripe_refund_id";