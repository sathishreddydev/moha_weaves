-- Add variantId to store_sale_items table
ALTER TABLE store_sale_items ADD COLUMN variant_id VARCHAR(255) REFERENCES product_variants(id);

-- Create index for better performance
CREATE INDEX idx_store_sale_items_variant_id ON store_sale_items(variant_id);
