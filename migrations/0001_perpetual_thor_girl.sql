ALTER TABLE "product_actual_prices" ADD COLUMN "total_actual_stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "payment_id";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "stripe_payment_intent_id";