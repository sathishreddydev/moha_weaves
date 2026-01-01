CREATE TYPE "public"."item_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'return_approved', 'return_completed', 'exchange_requested', 'exchange_approved', 'exchange_processing', 'exchange_shipped', 'exchange_delivered', 'exchange_completed');--> statement-breakpoint
CREATE TABLE "item_status_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" varchar NOT NULL,
	"status" "item_status" NOT NULL,
	"new_status" "item_status",
	"note" text,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_status_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "order_status_history" CASCADE;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'created'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('created', 'processing', 'completed', 'cancelled');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'created'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "status" "item_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "shipped_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "delivered_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "return_eligible_until" timestamp;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "item_status_history" ADD CONSTRAINT "item_status_history_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;