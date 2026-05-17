-- Add exchange_variant_id to online_exchange_items
-- Allows users to specify which size variant they want as the replacement
ALTER TABLE "online_exchange_items"
  ADD COLUMN IF NOT EXISTS "exchange_variant_id" varchar
    REFERENCES "product_variants"("id");
