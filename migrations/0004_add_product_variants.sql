-- Add product variants support
-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR UNIQUE,
    size VARCHAR NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    online_stock INTEGER NOT NULL DEFAULT 0,
    price DECIMAL(10,2),
    actual_price DECIMAL(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create variant_store_inventory table
CREATE TABLE IF NOT EXISTS variant_store_inventory (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id VARCHAR NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    store_id VARCHAR NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(variant_id, store_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_size ON product_variants(size);
CREATE INDEX IF NOT EXISTS idx_variant_store_inventory_variant_id ON variant_store_inventory(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_store_inventory_store_id ON variant_store_inventory(store_id);

-- Add hasVariants column to products table (if not exists)
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_variant_store_inventory_updated_at BEFORE UPDATE ON variant_store_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
