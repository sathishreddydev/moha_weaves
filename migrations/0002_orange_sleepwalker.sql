CREATE TYPE "public"."balance_direction" AS ENUM('refund_to_customer', 'due_from_customer', 'even');--> statement-breakpoint
CREATE TYPE "public"."store_exchange_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."return_status" ADD VALUE 'in_transit' BEFORE 'received';--> statement-breakpoint
CREATE TABLE "store_exchange_new_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange_id" varchar NOT NULL,
	"saree_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"line_amount" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_exchange_return_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exchange_id" varchar NOT NULL,
	"sale_item_id" varchar NOT NULL,
	"saree_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"return_amount" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_exchanges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar NOT NULL,
	"original_sale_id" varchar NOT NULL,
	"processed_by" varchar NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"reason" text,
	"notes" text,
	"return_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"new_items_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"balance_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"balance_direction" "balance_direction" DEFAULT 'even' NOT NULL,
	"status" "store_exchange_status" DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_status_history" ADD COLUMN "new_status" "order_status";--> statement-breakpoint
ALTER TABLE "store_sale_items" ADD COLUMN "returned_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_exchange_new_items" ADD CONSTRAINT "store_exchange_new_items_exchange_id_store_exchanges_id_fk" FOREIGN KEY ("exchange_id") REFERENCES "public"."store_exchanges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_exchange_new_items" ADD CONSTRAINT "store_exchange_new_items_saree_id_sarees_id_fk" FOREIGN KEY ("saree_id") REFERENCES "public"."sarees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_exchange_return_items" ADD CONSTRAINT "store_exchange_return_items_exchange_id_store_exchanges_id_fk" FOREIGN KEY ("exchange_id") REFERENCES "public"."store_exchanges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_exchange_return_items" ADD CONSTRAINT "store_exchange_return_items_sale_item_id_store_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."store_sale_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_exchange_return_items" ADD CONSTRAINT "store_exchange_return_items_saree_id_sarees_id_fk" FOREIGN KEY ("saree_id") REFERENCES "public"."sarees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_exchanges" ADD CONSTRAINT "store_exchanges_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_exchanges" ADD CONSTRAINT "store_exchanges_original_sale_id_store_sales_id_fk" FOREIGN KEY ("original_sale_id") REFERENCES "public"."store_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_exchanges" ADD CONSTRAINT "store_exchanges_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;