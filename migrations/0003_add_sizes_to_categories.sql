-- Add sizes column to categories table
ALTER TABLE categories ADD COLUMN sizes JSONB DEFAULT '[]';

-- Create index for better performance on JSONB queries
CREATE INDEX idx_categories_sizes ON categories USING GIN (sizes);
