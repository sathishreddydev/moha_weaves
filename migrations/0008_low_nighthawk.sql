CREATE TYPE "public"."exchange_status" AS ENUM('requested', 'approved', 'rejected', 'pickup_scheduled', 'picked_up', 'in_transit', 'received', 'inspected', 'completed', 'cancelled', 'exchange_requested', 'exchange_processing', 'exchange_packing', 'exchange_shipping', 'exchange_delivered');--> statement-breakpoint
-- Update existing orders with exchange statuses to confirmed
UPDATE orders SET status = 'confirmed' WHERE status LIKE 'exchange_%';
UPDATE order_status_history SET status = 'confirmed' WHERE status LIKE 'exchange_%';
UPDATE order_status_history SET new_status = 'confirmed' WHERE new_status LIKE 'exchange_%';
--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "new_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "new_status" SET DATA TYPE "public"."order_status" USING "new_status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";