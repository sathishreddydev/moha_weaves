-- Add variantId column to store_cart table
ALTER TABLE store_cart ADD COLUMN variant_id VARCHAR(255) REFERENCES product_variants(id);

-- Create index for better performance
CREATE INDEX idx_store_cart_variant_id ON store_cart(variant_id);
