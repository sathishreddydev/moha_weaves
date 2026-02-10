-- Add variantId column to order_items table
ALTER TABLE order_items ADD COLUMN variant_id VARCHAR(255) REFERENCES product_variants(id);

-- Create index for better performance
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);
