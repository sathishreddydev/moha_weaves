-- Sync VPS database with Drizzle schema (tables.ts)
-- Adds all missing columns and tables

-- ── orders: missing columns ──────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_type varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_value varchar;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_amount decimal(10,2) NOT NULL DEFAULT '0';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method shipping_method DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_waybill text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_order_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delhivery_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_type varchar DEFAULT 'complete';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_shipments integer DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_shipments integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_processed boolean DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_validated boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notified boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_scheduled boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_shipping_attempts integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_auto_shipping_attempt timestamp;

-- ── order_items: missing columns ─────────────────────────────────────────────
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_price decimal(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discounted_price decimal(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS offer_details json;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shipment_id varchar;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delhivery_waybill text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delhivery_package_id text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS weight decimal(8,3);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS dimensions text;

-- ── online_exchange_items: missing column ────────────────────────────────────
ALTER TABLE online_exchange_items ADD COLUMN IF NOT EXISTS exchange_variant_id varchar;

-- ── user_addresses: missing columns ──────────────────────────────────────────
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS address_line1 text NOT NULL DEFAULT '';
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT '';
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS address_type address_type NOT NULL DEFAULT 'home';

-- ── stock_requests: missing column ───────────────────────────────────────────
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS priority request_priority NOT NULL DEFAULT 'normal';

-- ── product_reviews: missing columns ─────────────────────────────────────────
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS order_item_id varchar;
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS unhelpful_count integer DEFAULT 0;

-- ── sales: missing column ────────────────────────────────────────────────────
ALTER TABLE sales ADD COLUMN IF NOT EXISTS bg_color text;

-- ── Missing tables ───────────────────────────────────────────────────────────

-- review_votes
CREATE TABLE IF NOT EXISTS review_votes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id varchar NOT NULL REFERENCES product_reviews(id),
  user_id varchar NOT NULL REFERENCES users(id),
  vote_type text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- shipments
CREATE TABLE IF NOT EXISTS shipments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL REFERENCES orders(id),
  waybill varchar,
  status shipment_status DEFAULT 'pending',
  items text,
  shipping_method shipping_method NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  shipped_at timestamp,
  delivered_at timestamp
);

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  action varchar(100) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id varchar(255) NOT NULL,
  old_values json,
  new_values json,
  ip_address varchar(45),
  user_agent text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
