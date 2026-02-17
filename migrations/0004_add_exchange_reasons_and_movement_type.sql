-- Add exchange movement type to stock_movement_type enum
ALTER TYPE stock_movement_type ADD VALUE 'exchange';

-- Add exchange type and specific reason to store exchange return items
ALTER TABLE store_exchange_return_items 
ADD COLUMN exchange_type VARCHAR(50) NOT NULL DEFAULT 'normal',
ADD COLUMN specific_reason VARCHAR(100) NOT NULL DEFAULT 'changed_mind',
ADD COLUMN damage_images TEXT DEFAULT '[]';

-- Remove reason column from store_exchanges table since we now have per-item reasons
ALTER TABLE store_exchanges DROP COLUMN IF EXISTS reason;
