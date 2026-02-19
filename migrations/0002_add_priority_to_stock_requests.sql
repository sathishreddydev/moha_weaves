-- Create the priority enum type first
CREATE TYPE request_priority AS ENUM ('urgent', 'high', 'normal', 'low');

-- Add priority column to stock_requests table with enum type and default
ALTER TABLE stock_requests 
ADD COLUMN priority request_priority NOT NULL DEFAULT 'normal';
