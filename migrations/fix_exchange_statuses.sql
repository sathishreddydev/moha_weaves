-- First, update any orders with exchange statuses to a valid status
UPDATE orders SET status = 'confirmed' WHERE status LIKE 'exchange_%';

-- Update order status history as well
UPDATE order_status_history SET status = 'confirmed' WHERE status LIKE 'exchange_%';
UPDATE order_status_history SET new_status = 'confirmed' WHERE new_status LIKE 'exchange_%';

-- Now run the migration
-- This will be handled by drizzle-kit push
