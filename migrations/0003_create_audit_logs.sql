-- Create dedicated audit_logs table for comprehensive audit tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'product', 'stock_request', 'order', 'stock_movement'
  entity_id VARCHAR NOT NULL,
  old_values JSONB, -- Previous state before change
  new_values JSONB, -- New state after change
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Create index for common audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_entity_time ON audit_logs(user_id, entity_type, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all inventory operations';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous state of the entity before the change (JSON format)';
COMMENT ON COLUMN audit_logs.new_values IS 'New state of the entity after the change (JSON format)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the user who performed the action';
COMMENT ON COLUMN audit_logs.user_agent IS 'Browser/user agent string of the client';
