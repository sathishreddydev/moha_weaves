-- Add subcategory_id column to products table
ALTER TABLE products ADD COLUMN subcategory_id VARCHAR REFERENCES subcategories(id);

-- Create index for better performance
CREATE INDEX idx_products_subcategory_id ON products(subcategory_id);
