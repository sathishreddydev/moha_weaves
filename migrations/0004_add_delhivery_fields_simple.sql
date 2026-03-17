-- Add Delhivery integration fields - Simple migration
-- Migration: 0004_add_delhivery_fields_simple.sql

-- Add shipping method enum (if not exists)
DO $$ BEGIN
    CREATE TYPE shipping_method AS ENUM ('manual', 'delhivery');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add shipment status enum (if not exists)
DO $$ BEGIN
    CREATE TYPE shipment_status AS ENUM ('pending', 'processing', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add Delhivery fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipping_method shipping_method DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS delhivery_waybill TEXT,
ADD COLUMN IF NOT EXISTS delhivery_order_id TEXT,
ADD COLUMN IF NOT EXISTS delhivery_status TEXT,
ADD COLUMN IF NOT EXISTS shipment_type VARCHAR DEFAULT 'complete',
ADD COLUMN IF NOT EXISTS total_shipments INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS completed_shipments INTEGER DEFAULT 0;

-- Add Delhivery fields to order_items table
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS shipment_id VARCHAR,
ADD COLUMN IF NOT EXISTS delhivery_waybill TEXT,
ADD COLUMN IF NOT EXISTS delhivery_package_id TEXT,
ADD COLUMN IF NOT EXISTS weight DECIMAL(8,3),
ADD COLUMN IF NOT EXISTS dimensions TEXT;

-- Create shipments table for split shipping
CREATE TABLE IF NOT EXISTS shipments (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    waybill VARCHAR,
    status shipment_status DEFAULT 'pending',
    items TEXT, -- JSON array of item IDs
    shipping_method shipping_method NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_shipping_method ON orders(shipping_method);
CREATE INDEX IF NOT EXISTS idx_orders_delhivery_waybill ON orders(delhivery_waybill);
CREATE INDEX IF NOT EXISTS idx_order_items_shipment_id ON order_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_order_items_delhivery_waybill ON order_items(delhivery_waybill);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_waybill ON shipments(waybill);
