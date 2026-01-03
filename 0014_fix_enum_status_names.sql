-- Update return_status enum to use full status names
DO $$ BEGIN
  -- Drop existing enum values and recreate with full names
  ALTER TYPE return_status RENAME TO return_status_old;
  
  CREATE TYPE return_status AS ENUM (
    'return_requested',
    'return_approved',
    'return_rejected',
    'return_pickup_scheduled',
    'return_picked_up',
    'return_in_transit',
    'return_received',
    'return_inspected',
    'return_completed',
    'return_cancelled'
  );
  
  -- Update the table columns to use new enum with mapping
  ALTER TABLE return_requests 
    ALTER COLUMN status TYPE return_status 
    USING CASE status::text
      WHEN 'requested' THEN 'return_requested'
      WHEN 'approved' THEN 'return_approved'
      WHEN 'rejected' THEN 'return_rejected'
      WHEN 'pickup_scheduled' THEN 'return_pickup_scheduled'
      WHEN 'picked_up' THEN 'return_picked_up'
      WHEN 'in_transit' THEN 'return_in_transit'
      WHEN 'received' THEN 'return_received'
      WHEN 'inspected' THEN 'return_inspected'
      WHEN 'completed' THEN 'return_completed'
      WHEN 'cancelled' THEN 'return_cancelled'
      ELSE 'return_requested'
    END::text::return_status;
  
  -- Drop old enum
  DROP TYPE return_status_old;
END $$;

-- Update online_exchange_status enum to use full status names
DO $$ BEGIN
  -- Drop existing enum values and recreate with full names
  ALTER TYPE online_exchange_status RENAME TO online_exchange_status_old;
  
  CREATE TYPE online_exchange_status AS ENUM (
    'exchange_requested',
    'exchange_approved',
    'exchange_processing',
    'exchange_pickup_scheduled',
    'exchange_picked_up',
    'exchange_in_transit',
    'exchange_received',
    'exchange_inspected',
    'exchange_shipped',
    'exchange_delivered',
    'exchange_completed',
    'exchange_cancelled'
  );
  
  -- Update the table columns to use new enum with mapping
  ALTER TABLE online_exchanges 
    ALTER COLUMN status TYPE online_exchange_status 
    USING CASE status::text
      WHEN 'requested' THEN 'exchange_requested'
      WHEN 'approved' THEN 'exchange_approved'
      WHEN 'processing' THEN 'exchange_processing'
      WHEN 'pickup_scheduled' THEN 'exchange_pickup_scheduled'
      WHEN 'picked_up' THEN 'exchange_picked_up'
      WHEN 'in_transit' THEN 'exchange_in_transit'
      WHEN 'received' THEN 'exchange_received'
      WHEN 'inspected' THEN 'exchange_inspected'
      WHEN 'shipped' THEN 'exchange_shipped'
      WHEN 'delivered' THEN 'exchange_delivered'
      WHEN 'completed' THEN 'exchange_completed'
      WHEN 'cancelled' THEN 'exchange_cancelled'
      ELSE 'exchange_requested'
    END::text::online_exchange_status;
  
  -- Drop old enum
  DROP TYPE online_exchange_status_old;
END $$;
