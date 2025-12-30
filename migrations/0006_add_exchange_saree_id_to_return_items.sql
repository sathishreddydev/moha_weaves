ALTER TABLE "return_items"
ADD COLUMN IF NOT EXISTS "exchange_saree_id" varchar;

DO $$ BEGIN
 ALTER TABLE "return_items" ADD CONSTRAINT "return_items_exchange_saree_id_sarees_id_fk" FOREIGN KEY ("exchange_saree_id") REFERENCES "public"."sarees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
