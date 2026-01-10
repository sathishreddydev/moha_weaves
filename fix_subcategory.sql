-- Fix subcategory_id column in products table
-- Run this SQL directly in your PostgreSQL database

-- Step 1: Add the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'subcategory_id'
    ) THEN
        RAISE NOTICE 'Column subcategory_id already exists';
    ELSE
        ALTER TABLE products ADD COLUMN subcategory_id VARCHAR;
        RAISE NOTICE 'Column subcategory_id added successfully';
    END IF;
END $$;

-- Step 2: Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'products_subcategory_id_fkey'
        AND table_name = 'products'
    ) THEN
        RAISE NOTICE 'Foreign key constraint already exists';
    ELSE
        ALTER TABLE products 
        ADD CONSTRAINT products_subcategory_id_fkey 
        FOREIGN KEY (subcategory_id) REFERENCES subcategories(id);
        RAISE NOTICE 'Foreign key constraint added successfully';
    END IF;
END $$;

-- Step 3: Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products(subcategory_id);

-- Success message
SELECT 'subcategory_id column and constraints have been added successfully!' as result;
