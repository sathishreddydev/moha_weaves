CREATE TABLE "store_customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" varchar NOT NULL,
	"email" text,
	"store_id" varchar NOT NULL,
	"total_purchases" numeric(10, 2) DEFAULT '0' NOT NULL,
	"purchase_count" integer DEFAULT 1 NOT NULL,
	"first_purchase_date" timestamp DEFAULT now() NOT NULL,
	"last_purchase_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "store_sales" ADD COLUMN "customer_id" varchar;--> statement-breakpoint
ALTER TABLE "store_customers" ADD CONSTRAINT "store_customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sales" ADD CONSTRAINT "store_sales_customer_id_store_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."store_customers"("id") ON DELETE no action ON UPDATE no action;