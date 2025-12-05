
-- Update the return_status enum to ensure correct order
-- This migration updates the enum type definition
DO $$ BEGIN
  -- Drop existing enum values and recreate in correct order
  ALTER TYPE return_status RENAME TO return_status_old;
  
  CREATE TYPE return_status AS ENUM (
    'requested',
    'approved', 
    'rejected',
    'pickup_scheduled',
    'picked_up',
    'in_transit',
    'received',
    'inspection',
    'inspected',
    'completed',
    'cancelled'
  );
  
  -- Update the table columns to use new enum
  ALTER TABLE return_requests 
    ALTER COLUMN status TYPE return_status 
    USING status::text::return_status;
  
  -- Drop old enum
  DROP TYPE return_status_old;
END $$;
