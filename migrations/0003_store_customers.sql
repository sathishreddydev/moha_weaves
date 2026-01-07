-- Create store customers table
CREATE TABLE store_customers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone VARCHAR UNIQUE NOT NULL,
  email TEXT,
  store_id VARCHAR NOT NULL REFERENCES stores(id),
  total_purchases DECIMAL(10, 2) NOT NULL DEFAULT 0,
  purchase_count INTEGER NOT NULL DEFAULT 1,
  first_purchase_date TIMESTAMP NOT NULL DEFAULT NOW(),
  last_purchase_date TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add customer_id foreign key to store_sales
ALTER TABLE store_sales ADD COLUMN customer_id VARCHAR REFERENCES store_customers(id);

-- Create indexes for better performance
CREATE INDEX idx_store_customers_phone ON store_customers(phone);
CREATE INDEX idx_store_customers_store_id ON store_customers(store_id);
CREATE INDEX idx_store_sales_customer_id ON store_sales(customer_id);

-- Add comment for documentation
COMMENT ON TABLE store_customers IS 'Customer profiles for in-store purchases';
COMMENT ON COLUMN store_sales.customer_id IS 'Optional link to customer profile';
