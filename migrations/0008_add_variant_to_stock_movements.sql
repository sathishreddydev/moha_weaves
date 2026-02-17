-- Add variantId to stock_movements table
ALTER TABLE stock_movements ADD COLUMN variant_id VARCHAR(255) REFERENCES product_variants(id);

-- Create index for better performance
CREATE INDEX idx_stock_movements_variant_id ON stock_movements(variant_id);
