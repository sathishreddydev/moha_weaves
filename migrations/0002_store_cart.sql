-- Create store cart table
CREATE TABLE IF NOT EXISTS store_cart (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR NOT NULL REFERENCES stores(id),
    saree_id VARCHAR NOT NULL REFERENCES sarees(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    line_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_store_cart_store_id ON store_cart(store_id);
CREATE INDEX IF NOT EXISTS idx_store_cart_saree_id ON store_cart(saree_id);
