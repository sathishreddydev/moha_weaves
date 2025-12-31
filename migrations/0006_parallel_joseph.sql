ALTER TYPE "public"."order_status" ADD VALUE 'exchange_requested';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'exchange_packing';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'exchange_shipping';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'exchange_delivered_with_pickup';--> statement-breakpoint
ALTER TABLE "return_items" ADD COLUMN "exchange_saree_id" varchar;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_exchange_saree_id_sarees_id_fk" FOREIGN KEY ("exchange_saree_id") REFERENCES "public"."sarees"("id") ON DELETE no action ON UPDATE no action;