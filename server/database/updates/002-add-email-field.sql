-- Add email field to orders table for notifications
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Create index for email field
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);

-- Add comment
ALTER TABLE orders COMMENT = 'Enhanced orders table with automatic shipping support and email notifications';
