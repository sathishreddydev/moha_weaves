CREATE TYPE "public"."offer_type" AS ENUM('percentage', 'flat', 'category', 'product', 'flash_sale');--> statement-breakpoint
CREATE TABLE "sale_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" varchar NOT NULL,
	"saree_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"offer_type" "offer_type" NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"category_id" varchar,
	"min_order_amount" numeric(10, 2),
	"max_discount" numeric(10, 2),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"banner_image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_products" ADD CONSTRAINT "sale_products_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_products" ADD CONSTRAINT "sale_products_saree_id_sarees_id_fk" FOREIGN KEY ("saree_id") REFERENCES "public"."sarees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;