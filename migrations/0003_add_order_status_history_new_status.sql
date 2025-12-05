
-- Add newStatus column to order_status_history table
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS new_status order_status;

-- Update existing records to copy status to newStatus for backwards compatibility
UPDATE order_status_history SET new_status = status WHERE new_status IS NULL;
