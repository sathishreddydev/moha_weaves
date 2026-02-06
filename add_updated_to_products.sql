-- Add updatedAt column to products table
ALTER TABLE products ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW();
