-- Add variantId column to cart table
ALTER TABLE cart ADD COLUMN variant_id VARCHAR(255) REFERENCES product_variants(id);

-- Create index for better performance
CREATE INDEX idx_cart_variant_id ON cart(variant_id);
