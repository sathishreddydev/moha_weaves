CREATE TABLE "store_cart" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" varchar NOT NULL,
	"saree_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"line_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_sales" ADD COLUMN "discount_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "store_sales" ADD COLUMN "tax_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "store_sales" ADD COLUMN "payment_mode" varchar DEFAULT 'cash';--> statement-breakpoint
ALTER TABLE "store_cart" ADD CONSTRAINT "store_cart_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_cart" ADD CONSTRAINT "store_cart_saree_id_sarees_id_fk" FOREIGN KEY ("saree_id") REFERENCES "public"."sarees"("id") ON DELETE no action ON UPDATE no action;