CREATE TYPE "public"."damage_category" AS ENUM('manufacturing_defect', 'shipping_damage', 'storage_damage', 'handling_damage', 'customer_damage', 'expired', 'theft_loss', 'other');--> statement-breakpoint
CREATE TYPE "public"."damage_severity" AS ENUM('minor', 'major', 'total_loss');--> statement-breakpoint
CREATE TYPE "public"."damage_source" AS ENUM('store', 'online_return', 'warehouse', 'shipping', 'manufacturing');--> statement-breakpoint
CREATE TABLE "product_damages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"source" "damage_source" NOT NULL,
	"quantity" integer NOT NULL,
	"damage_category" "damage_category" NOT NULL,
	"damage_severity" "damage_severity" NOT NULL,
	"reason" text NOT NULL,
	"reported_by" varchar NOT NULL,
	"approved_by" varchar,
	"cost_value" numeric(10, 2),
	"recovery_value" numeric(10, 2),
	"disposal_method" text,
	"notes" text,
	"allocation_type" varchar,
	"store_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_damages" ADD CONSTRAINT "product_damages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_damages" ADD CONSTRAINT "product_damages_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_damages" ADD CONSTRAINT "product_damages_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_damages" ADD CONSTRAINT "product_damages_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;