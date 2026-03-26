-- ============================================
-- Automatic Shipping System Database Updates
-- ============================================

-- 1. Enhanced Orders Table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS autoProcessed BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS shippingMethod VARCHAR(50) DEFAULT 'delhivery',
ADD COLUMN IF NOT EXISTS delhiveryWaybill TEXT,
ADD COLUMN IF NOT EXISTS delhiveryOrderId TEXT,
ADD COLUMN IF NOT EXISTS delhiveryStatus TEXT,
ADD COLUMN IF NOT EXISTS alternativeCourier TEXT,
ADD COLUMN IF NOT EXISTS shippingCost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS estimatedDelivery DATE,
ADD COLUMN IF NOT EXISTS shippingPriority VARCHAR(20) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS addressValidated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS customerNotified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pickupScheduled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS autoShippingAttempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lastAutoShippingAttempt TIMESTAMP;

-- 2. Enhanced Order Items Table
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS delhiveryPackageId TEXT,
ADD COLUMN IF NOT EXISTS shipmentId TEXT,
ADD COLUMN IF NOT EXISTS weight DECIMAL(10,2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS dimensions TEXT; -- "LxBxH" format

-- 3. Shipping Automation Logs Table
CREATE TABLE IF NOT EXISTS shipping_automation_logs (
  id VARCHAR(255) PRIMARY KEY,
  orderId VARCHAR(255) REFERENCES orders(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  details TEXT,
  error TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  automated BOOLEAN DEFAULT TRUE,
  INDEX idx_order_id (orderId),
  INDEX idx_timestamp (timestamp),
  INDEX idx_status (status)
);

-- 4. Alternative Couriers Table
CREATE TABLE IF NOT EXISTS alternative_couriers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  apiEndpoint TEXT,
  isActive BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 1,
  serviceablePincodes TEXT, -- JSON array of serviceable pincodes
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_active_priority (isActive, priority)
);

-- 5. Shipping Automation Rules Table
CREATE TABLE IF NOT EXISTS shipping_automation_rules (
  id VARCHAR(255) PRIMARY KEY,
  ruleName VARCHAR(100) NOT NULL,
  ruleType VARCHAR(50) NOT NULL, -- 'auto_process', 'fallback', 'priority', 'validation'
  conditions TEXT, -- JSON conditions
  actions TEXT, -- JSON actions
  isActive BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 1,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_active_priority (isActive, priority)
);

-- 6. Delhivery Tracking History Table
CREATE TABLE IF NOT EXISTS delhivery_tracking_history (
  id VARCHAR(255) PRIMARY KEY,
  waybill VARCHAR(255) NOT NULL,
  status VARCHAR(100) NOT NULL,
  location TEXT,
  timestamp TIMESTAMP NOT NULL,
  description TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_waybill (waybill),
  INDEX idx_timestamp (timestamp),
  INDEX idx_status (status)
);

-- 7. Shipments Table (for tracking multiple shipments per order)
CREATE TABLE IF NOT EXISTS shipments (
  id VARCHAR(255) PRIMARY KEY,
  orderId VARCHAR(255) REFERENCES orders(id) ON DELETE CASCADE,
  waybill VARCHAR(255) NOT NULL,
  status VARCHAR(100) DEFAULT 'processing',
  items TEXT, -- JSON array of item IDs
  shippingMethod VARCHAR(50) DEFAULT 'delhivery',
  courier VARCHAR(50),
  estimatedDelivery DATE,
  actualDelivery DATE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (orderId),
  INDEX idx_waybill (waybill),
  INDEX idx_status (status)
);

-- 8. Address Validation Cache Table
CREATE TABLE IF NOT EXISTS address_validation_cache (
  id VARCHAR(255) PRIMARY KEY,
  addressHash VARCHAR(255) NOT NULL UNIQUE, -- Hash of the address for caching
  originalAddress TEXT NOT NULL, -- JSON of original address
  validatedAddress TEXT, -- JSON of validated address
  isServiceable BOOLEAN,
  serviceabilityDetails TEXT, -- JSON of serviceability details
  validationErrors TEXT, -- JSON of validation errors
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiresAt TIMESTAMP,
  INDEX idx_address_hash (addressHash),
  INDEX idx_expires_at (expiresAt)
);

-- 9. Insert Default Automation Rules
INSERT INTO shipping_automation_rules (id, ruleName, ruleType, conditions, actions, isActive, priority) VALUES
('auto-all-orders', 'Process all orders automatically', 'auto_process', '{"always": true}', '{"shippingMethod": "delhivery", "priority": "high", "validateAddress": true}', TRUE, 1),
('fallback-alternatives', 'Use alternative couriers if Delhivery fails', 'fallback', '{"delhiveryFailed": true}', '{"tryAlternatives": ["blue-dart", "xpressbees", "fedex"]}', TRUE, 2),
('validate-address', 'Validate address before shipping', 'validation', '{"validateAddress": true}', '{"standardizeFormat": true, "checkServiceability": true}', TRUE, 3),
('notify-customer', 'Send notifications to customer', 'notification', '{"orderCreated": true, "shipped": true}', '{"sendSMS": true, "sendEmail": true}', TRUE, 4)
ON CONFLICT (id) DO NOTHING;

-- 10. Insert Default Alternative Couriers
INSERT INTO alternative_couriers (id, name, apiEndpoint, isActive, priority) VALUES
('blue-dart', 'Blue Dart', 'https://api.bluedart.com/v1/shipments', TRUE, 1),
('xpressbees', 'Xpressbees', 'https://api.xpressbees.com/v1/shipments', TRUE, 2),
('fedex', 'FedEx', 'https://api.fedex.com/v1/shipments', TRUE, 3),
('dtdc', 'DTDC', 'https://api.dtdc.com/v1/shipments', FALSE, 4)
ON CONFLICT (id) DO NOTHING;

-- 11. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_orders_auto_processed ON orders(autoProcessed);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_method ON orders(shippingMethod);
CREATE INDEX IF NOT EXISTS idx_orders_delhivery_waybill ON orders(delhiveryWaybill);
CREATE INDEX IF NOT EXISTS idx_orders_estimated_delivery ON orders(estimatedDelivery);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(createdAt);

CREATE INDEX IF NOT EXISTS idx_order_items_shipment_id ON order_items(shipmentId);
CREATE INDEX IF NOT EXISTS idx_order_items_delhivery_waybill ON order_items(delhiveryWaybill);

-- 12. Add Triggers for Timestamp Updates
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_shipments_timestamp 
BEFORE UPDATE ON shipments
FOR EACH ROW
BEGIN
    SET NEW.updatedAt = CURRENT_TIMESTAMP;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_alternative_couriers_timestamp 
BEFORE UPDATE ON alternative_couriers
FOR EACH ROW
BEGIN
    SET NEW.updatedAt = CURRENT_TIMESTAMP;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_shipping_automation_rules_timestamp 
BEFORE UPDATE ON shipping_automation_rules
FOR EACH ROW
BEGIN
    SET NEW.updatedAt = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- 13. Create Views for Common Queries
CREATE OR REPLACE VIEW order_shipping_summary AS
SELECT 
    o.id as orderId,
    o.customerName,
    o.finalAmount,
    o.status as orderStatus,
    o.shippingMethod,
    o.delhiveryWaybill,
    o.delhiveryStatus,
    o.estimatedDelivery,
    o.autoProcessed,
    o.customerNotified,
    o.createdAt as orderDate,
    COUNT(oi.id) as itemCount,
    s.status as shipmentStatus,
    s.courier,
    s.actualDelivery
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.orderId
LEFT JOIN shipments s ON o.id = s.orderId
GROUP BY o.id, s.id;

-- 14. Add Comments for Documentation
ALTER TABLE orders COMMENT = 'Enhanced orders table with automatic shipping support';
ALTER TABLE order_items COMMENT = 'Order items with shipping and tracking details';
ALTER TABLE shipping_automation_logs COMMENT = 'Logs for all shipping automation actions';
ALTER TABLE alternative_couriers COMMENT = 'Alternative courier services for fallback';
ALTER TABLE shipping_automation_rules COMMENT = 'Rules governing automatic shipping decisions';
ALTER TABLE delhivery_tracking_history COMMENT = 'Historical tracking data from Delhivery';
ALTER TABLE shipments COMMENT = 'Individual shipment tracking for orders';
ALTER TABLE address_validation_cache COMMENT = 'Cache for address validation results';

-- ============================================
-- Migration Complete
-- ============================================
