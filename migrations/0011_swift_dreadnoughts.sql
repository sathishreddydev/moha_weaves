CREATE TYPE "public"."online_exchange_status" AS ENUM('requested', 'approved', 'pickup_scheduled', 'picked_up', 'in_transit', 'received', 'inspected', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "online_exchange_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange_id" varchar NOT NULL,
	"order_item_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"exchange_saree_id" varchar,
	"condition" text,
	"is_restockable" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "online_exchanges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" "online_exchange_status" DEFAULT 'requested' NOT NULL,
	"reason" "return_reason" NOT NULL,
	"reason_details" text,
	"pickup_address" text,
	"pickup_scheduled_at" timestamp,
	"picked_up_at" timestamp,
	"received_at" timestamp,
	"inspection_notes" text,
	"processed_by" varchar,
	"exchange_order_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "return_items" DROP CONSTRAINT "return_items_exchange_saree_id_sarees_id_fk";
--> statement-breakpoint
ALTER TABLE "online_exchange_items" ADD CONSTRAINT "online_exchange_items_exchange_id_online_exchanges_id_fk" FOREIGN KEY ("exchange_id") REFERENCES "public"."online_exchanges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exchange_items" ADD CONSTRAINT "online_exchange_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exchange_items" ADD CONSTRAINT "online_exchange_items_exchange_saree_id_sarees_id_fk" FOREIGN KEY ("exchange_saree_id") REFERENCES "public"."sarees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exchanges" ADD CONSTRAINT "online_exchanges_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_exchanges" ADD CONSTRAINT "online_exchanges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" DROP COLUMN "exchange_saree_id";