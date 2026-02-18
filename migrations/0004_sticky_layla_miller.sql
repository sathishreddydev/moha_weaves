ALTER TYPE "public"."stock_movement_type" ADD VALUE 'exchange';--> statement-breakpoint
ALTER TABLE "store_exchange_return_items" ADD COLUMN "variant_id" varchar;--> statement-breakpoint
ALTER TABLE "store_exchange_return_items" ADD COLUMN "exchange_type" varchar(50) DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_exchange_return_items" ADD COLUMN "specific_reason" varchar(100) DEFAULT 'changed_mind' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_exchange_return_items" ADD COLUMN "damage_images" text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "store_exchange_return_items" ADD CONSTRAINT "store_exchange_return_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" DROP COLUMN "reason";--> statement-breakpoint
ALTER TABLE "store_exchanges" DROP COLUMN "reason";